import express from 'express';
import Joi from 'joi';
import DatasetJob from '../models/DatasetJob.js';
import { authenticate, checkJobLimits, requireSubscription } from '../middleware/auth.js';
import { setupLogger } from '../config/logger.js';
import { queueJob } from '../services/jobQueue.js';

const router = express.Router();
const logger = setupLogger();

// Validation schemas
const createJobSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  jobType: Joi.string().valid('rule-based', 'ai-augmentation', 'anonymization', 'synthetic-compliance').required(),
  configuration: Joi.object().required(),
  priority: Joi.string().valid('low', 'normal', 'high').default('normal')
});

const ruleBasedConfigSchema = Joi.object({
  schema: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('string', 'integer', 'float', 'email', 'phone', 'date', 'boolean').required(),
    constraints: Joi.string().optional(),
    required: Joi.boolean().default(false)
  })).min(1).required(),
  recordCount: Joi.number().min(1).max(1000000).required(),
  outputFormat: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
  includeHeaders: Joi.boolean().default(true)
});

const aiAugmentationConfigSchema = Joi.object({
  sourceFile: Joi.object({
    filename: Joi.string().required(),
    originalName: Joi.string().required(),
    size: Joi.number().required(),
    mimetype: Joi.string().required(),
    path: Joi.string().required()
  }).required(),
  augmentationRatio: Joi.number().min(0.1).max(10).default(1),
  outputFormat: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
  includeHeaders: Joi.boolean().default(true)
});

const anonymizationConfigSchema = Joi.object({
  sourceFile: Joi.object({
    filename: Joi.string().required(),
    originalName: Joi.string().required(),
    size: Joi.number().required(),
    mimetype: Joi.string().required(),
    path: Joi.string().required()
  }).required(),
  anonymizationMethods: Joi.array().items(Joi.object({
    field: Joi.string().required(),
    method: Joi.string().valid('mask', 'hash', 'generalize', 'suppress', 'pseudonymize').required(),
    parameters: Joi.object().optional()
  })).min(1).required(),
  outputFormat: Joi.string().valid('csv', 'json', 'xlsx').default('csv'),
  includeHeaders: Joi.boolean().default(true)
});

// @route   POST /api/jobs
// @desc    Create a new data generation job
// @access  Private
router.post('/', authenticate, checkJobLimits, async (req, res) => {
  try {
    // Validate basic job structure
    const { error: jobError, value: jobData } = createJobSchema.validate(req.body);
    if (jobError) {
      return res.status(400).json({
        success: false,
        message: jobError.details[0].message
      });
    }

    // Validate job-specific configuration
    let configError;
    switch (jobData.jobType) {
      case 'rule-based':
        const { error: ruleError } = ruleBasedConfigSchema.validate(jobData.configuration);
        configError = ruleError;
        break;
      case 'ai-augmentation':
        const { error: aiError } = aiAugmentationConfigSchema.validate(jobData.configuration);
        configError = aiError;
        // Check subscription tier for AI features
        if (req.user.subscriptionTier === 'basic') {
          return res.status(403).json({
            success: false,
            message: 'AI-powered augmentation requires Pro or Enterprise subscription'
          });
        }
        break;
      case 'anonymization':
        const { error: anonError } = anonymizationConfigSchema.validate(jobData.configuration);
        configError = anonError;
        break;
    }

    if (configError) {
      return res.status(400).json({
        success: false,
        message: `Configuration error: ${configError.details[0].message}`
      });
    }

    // Create job
    const job = new DatasetJob({
      userId: req.user._id,
      name: jobData.name,
      description: jobData.description,
      jobType: jobData.jobType,
      configuration: jobData.configuration,
      priority: jobData.priority
    });

    await job.save();

    // Queue job for processing
    await queueJob(job);

    logger.info(`Job created: ${job.jobId} by user ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      data: {
        job: {
          id: job._id,
          jobId: job.jobId,
          name: job.name,
          description: job.description,
          jobType: job.jobType,
          status: job.status,
          progress: job.progress,
          priority: job.priority,
          configuration: job.configuration,
          createdAt: job.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Job creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job'
    });
  }
});

// @route   GET /api/jobs
// @desc    Get user's jobs with pagination and filtering
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const jobType = req.query.jobType;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    // Build query
    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (jobType) query.jobType = jobType;

    // Execute query with pagination
    const jobs = await DatasetJob.find(query)
      .sort({ [sortBy]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'firstName lastName email');

    const total = await DatasetJob.countDocuments(query);

    res.json({
      success: true,
      data: {
        jobs: jobs.map(job => ({
          id: job._id,
          jobId: job.jobId,
          name: job.name,
          description: job.description,
          jobType: job.jobType,
          status: job.status,
          statusDisplay: job.statusDisplay,
          progress: job.progress,
          priority: job.priority,
          results: job.results,
          error: job.error,
          duration: job.duration,
          timeUntilExpiry: job.timeUntilExpiry,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        })),
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalJobs: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    logger.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve jobs'
    });
  }
});

// @route   GET /api/jobs/:jobId
// @desc    Get specific job details
// @access  Private
router.get('/:jobId', authenticate, async (req, res) => {
  try {
    const job = await DatasetJob.findOne({
      $or: [
        { jobId: req.params.jobId },
        { _id: req.params.jobId }
      ],
      userId: req.user._id
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        job: {
          id: job._id,
          jobId: job.jobId,
          name: job.name,
          description: job.description,
          jobType: job.jobType,
          status: job.status,
          statusDisplay: job.statusDisplay,
          progress: job.progress,
          priority: job.priority,
          configuration: job.configuration,
          results: job.results,
          error: job.error,
          duration: job.duration,
          timeUntilExpiry: job.timeUntilExpiry,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          expiresAt: job.expiresAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job'
    });
  }
});

// @route   DELETE /api/jobs/:jobId
// @desc    Cancel/delete a job
// @access  Private
router.delete('/:jobId', authenticate, async (req, res) => {
  try {
    const job = await DatasetJob.findOne({
      $or: [
        { jobId: req.params.jobId },
        { _id: req.params.jobId }
      ],
      userId: req.user._id
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Can only cancel queued or running jobs
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel job with status: ${job.status}`
      });
    }

    job.status = 'cancelled';
    await job.save();

    logger.info(`Job cancelled: ${job.jobId} by user ${req.user.email}`);

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    logger.error('Cancel job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel job'
    });
  }
});

// @route   GET /api/jobs/stats/summary
// @desc    Get job statistics for dashboard
// @access  Private
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get job counts by status
    const statusStats = await DatasetJob.aggregate([
      { $match: { userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get job counts by type
    const typeStats = await DatasetJob.aggregate([
      { $match: { userId } },
      { $group: { _id: '$jobType', count: { $sum: 1 } } }
    ]);

    // Get total data generated
    const dataStats = await DatasetJob.aggregate([
      { $match: { userId, status: 'completed' } },
      { $group: { _id: null, totalRecords: { $sum: '$results.recordsGenerated' } } }
    ]);

    // Get recent jobs
    const recentJobs = await DatasetJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('jobId name jobType status progress createdAt completedAt');

    // Format response
    const statusCounts = {
      total: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    statusStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
      statusCounts.total += stat.count;
    });

    const typeCounts = {};
    typeStats.forEach(stat => {
      typeCounts[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        statusCounts,
        typeCounts,
        totalRecordsGenerated: dataStats[0]?.totalRecords || 0,
        recentJobs: recentJobs.map(job => ({
          id: job._id,
          jobId: job.jobId,
          name: job.name,
          jobType: job.jobType,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Get job stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job statistics'
    });
  }
});

export default router;
