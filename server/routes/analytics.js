import express from 'express';
import { authenticate } from '../middleware/auth.js';
import DatasetJob from '../models/DatasetJob.js';
import User from '../models/User.js';
import { setupLogger } from '../config/logger.js';
import { getQueueStats } from '../services/jobQueue.js';

const router = express.Router();
const logger = setupLogger();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics for the user
// @access  Private
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const timeRange = req.query.timeRange || '30d'; // 7d, 30d, 90d, 1y

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get job statistics
    const jobStats = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRecords: { $sum: '$results.recordsGenerated' },
          avgExecutionTime: { $avg: '$results.executionTime' }
        }
      }
    ]);

    // Get job type distribution
    const jobTypeStats = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$jobType',
          count: { $sum: 1 },
          totalRecords: { $sum: '$results.recordsGenerated' }
        }
      }
    ]);

    // Get daily job creation trend
    const dailyTrend = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          count: { $sum: 1 },
          recordsGenerated: { $sum: '$results.recordsGenerated' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Get recent activity
    const recentJobs = await DatasetJob.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('jobId name jobType status progress results.recordsGenerated createdAt completedAt');

    // Calculate totals
    const totalJobs = jobStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalRecords = jobStats.reduce((sum, stat) => sum + (stat.totalRecords || 0), 0);
    const completedJobs = jobStats.find(stat => stat._id === 'completed')?.count || 0;
    const failedJobs = jobStats.find(stat => stat._id === 'failed')?.count || 0;
    const successRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

    // Format response
    const statusCounts = {
      total: totalJobs,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    jobStats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    const typeCounts = {};
    jobTypeStats.forEach(stat => {
      typeCounts[stat._id] = {
        count: stat.count,
        totalRecords: stat.totalRecords || 0
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalJobs,
          totalRecords,
          successRate,
          timeRange
        },
        statusCounts,
        typeCounts,
        dailyTrend: dailyTrend.map(day => ({
          date: day._id,
          jobs: day.count,
          records: day.recordsGenerated || 0
        })),
        recentActivity: recentJobs.map(job => ({
          id: job._id,
          jobId: job.jobId,
          name: job.name,
          jobType: job.jobType,
          status: job.status,
          progress: job.progress,
          recordsGenerated: job.results?.recordsGenerated || 0,
          createdAt: job.createdAt,
          completedAt: job.completedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard analytics'
    });
  }
});

// @route   GET /api/analytics/usage
// @desc    Get detailed usage analytics
// @access  Private
router.get('/usage', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = req.user;

    // Get monthly usage trend
    const monthlyUsage = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          createdAt: { $gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) } // Last 12 months
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          jobs: { $sum: 1 },
          records: { $sum: '$results.recordsGenerated' },
          dataSize: { $sum: '$results.outputFile.size' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Get current usage stats
    const currentUsage = {
      dataUsed: user.dataUsage.current,
      dataLimit: user.subscriptionLimits.dataLimit,
      percentage: user.subscriptionLimits.dataLimit === -1 
        ? 0 
        : Math.round((user.dataUsage.current / user.subscriptionLimits.dataLimit) * 100),
      resetDate: user.dataUsage.resetDate,
      subscriptionTier: user.subscriptionTier
    };

    // Get job type usage breakdown
    const jobTypeUsage = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$jobType',
          jobs: { $sum: 1 },
          records: { $sum: '$results.recordsGenerated' },
          dataSize: { $sum: '$results.outputFile.size' },
          avgExecutionTime: { $avg: '$results.executionTime' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        currentUsage,
        monthlyTrend: monthlyUsage.map(month => ({
          period: `${month._id.year}-${month._id.month.toString().padStart(2, '0')}`,
          jobs: month.jobs,
          records: month.records,
          dataSize: month.dataSize || 0
        })),
        jobTypeBreakdown: jobTypeUsage.map(type => ({
          jobType: type._id,
          jobs: type.jobs,
          records: type.records,
          dataSize: type.dataSize || 0,
          avgExecutionTime: Math.round(type.avgExecutionTime || 0)
        }))
      }
    });
  } catch (error) {
    logger.error('Usage analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve usage analytics'
    });
  }
});

// @route   GET /api/analytics/performance
// @desc    Get performance analytics
// @access  Private
router.get('/performance', authenticate, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get performance metrics
    const performanceStats = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          'results.executionTime': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$jobType',
          avgExecutionTime: { $avg: '$results.executionTime' },
          minExecutionTime: { $min: '$results.executionTime' },
          maxExecutionTime: { $max: '$results.executionTime' },
          avgRecordsPerSecond: {
            $avg: {
              $divide: ['$results.recordsGenerated', { $divide: ['$results.executionTime', 1000] }]
            }
          },
          totalJobs: { $sum: 1 }
        }
      }
    ]);

    // Get quality metrics
    const qualityStats = await DatasetJob.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          'results.qualityMetrics': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$jobType',
          avgDataQuality: { $avg: '$results.qualityMetrics.dataQualityScore' },
          avgPrivacyScore: { $avg: '$results.qualityMetrics.privacyScore' },
          avgDiversityScore: { $avg: '$results.qualityMetrics.diversityScore' },
          totalJobs: { $sum: 1 }
        }
      }
    ]);

    // Get system performance (queue stats)
    const queueStats = await getQueueStats();

    res.json({
      success: true,
      data: {
        executionPerformance: performanceStats.map(stat => ({
          jobType: stat._id,
          avgExecutionTime: Math.round(stat.avgExecutionTime),
          minExecutionTime: Math.round(stat.minExecutionTime),
          maxExecutionTime: Math.round(stat.maxExecutionTime),
          avgRecordsPerSecond: Math.round(stat.avgRecordsPerSecond || 0),
          totalJobs: stat.totalJobs
        })),
        qualityMetrics: qualityStats.map(stat => ({
          jobType: stat._id,
          avgDataQuality: Math.round(stat.avgDataQuality || 0),
          avgPrivacyScore: Math.round(stat.avgPrivacyScore || 0),
          avgDiversityScore: Math.round(stat.avgDiversityScore || 0),
          totalJobs: stat.totalJobs
        })),
        systemPerformance: {
          queueStats,
          timestamp: new Date()
        }
      }
    });
  } catch (error) {
    logger.error('Performance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance analytics'
    });
  }
});

export default router;
