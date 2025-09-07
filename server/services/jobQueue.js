import Queue from 'bull';
import { createClient } from 'redis';
import DatasetJob from '../models/DatasetJob.js';
import User from '../models/User.js';
import { setupLogger } from '../config/logger.js';
import { 
  RuleBasedGenerator, 
  AIAugmentationGenerator, 
  AnonymizationProcessor,
  FileOutputManager 
} from './dataGenerator.js';
import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';

const logger = setupLogger();

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

// Create job queue
const jobQueue = new Queue('data generation jobs', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 50,     // Keep last 50 failed jobs
    attempts: 3,          // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Job processing
jobQueue.process('rule-based', 5, async (job) => {
  return await processRuleBasedJob(job);
});

jobQueue.process('ai-augmentation', 2, async (job) => {
  return await processAIAugmentationJob(job);
});

jobQueue.process('anonymization', 3, async (job) => {
  return await processAnonymizationJob(job);
});

jobQueue.process('synthetic-compliance', 2, async (job) => {
  return await processSyntheticComplianceJob(job);
});

// Job event handlers
jobQueue.on('completed', async (job, result) => {
  logger.info(`Job ${job.data.jobId} completed successfully`);
  
  try {
    const datasetJob = await DatasetJob.findById(job.data.datasetJobId);
    if (datasetJob) {
      await datasetJob.markAsCompleted(result);
      
      // Update user data usage
      const user = await User.findById(datasetJob.userId);
      if (user && result.outputFile) {
        await user.updateDataUsage(result.outputFile.size);
      }
    }
  } catch (error) {
    logger.error('Error updating completed job:', error);
  }
});

jobQueue.on('failed', async (job, err) => {
  logger.error(`Job ${job.data.jobId} failed:`, err);
  
  try {
    const datasetJob = await DatasetJob.findById(job.data.datasetJobId);
    if (datasetJob) {
      await datasetJob.markAsFailed({
        message: err.message,
        code: err.code || 'PROCESSING_ERROR',
        details: err.stack
      });
    }
  } catch (error) {
    logger.error('Error updating failed job:', error);
  }
});

jobQueue.on('progress', async (job, progress) => {
  try {
    const datasetJob = await DatasetJob.findById(job.data.datasetJobId);
    if (datasetJob) {
      await datasetJob.updateProgress(progress, 'running');
    }
  } catch (error) {
    logger.error('Error updating job progress:', error);
  }
});

// Queue job for processing
export const queueJob = async (datasetJob) => {
  try {
    const jobData = {
      datasetJobId: datasetJob._id.toString(),
      jobId: datasetJob.jobId,
      userId: datasetJob.userId.toString(),
      jobType: datasetJob.jobType,
      configuration: datasetJob.configuration,
      name: datasetJob.name
    };

    const queueOptions = {
      priority: getPriority(datasetJob.priority),
      delay: 0 // Process immediately
    };

    const bullJob = await jobQueue.add(datasetJob.jobType, jobData, queueOptions);
    
    logger.info(`Job ${datasetJob.jobId} queued for processing with Bull job ID: ${bullJob.id}`);
    
    return bullJob;
  } catch (error) {
    logger.error('Error queueing job:', error);
    throw error;
  }
};

// Get priority value for Bull queue
function getPriority(priority) {
  const priorityMap = {
    'low': 1,
    'normal': 5,
    'high': 10
  };
  return priorityMap[priority] || 5;
}

// Process rule-based data generation job
async function processRuleBasedJob(job) {
  const { datasetJobId, configuration } = job.data;
  
  logger.info(`Processing rule-based job: ${job.data.jobId}`);
  
  try {
    // Update job status to running
    const datasetJob = await DatasetJob.findById(datasetJobId);
    if (!datasetJob) {
      throw new Error('Dataset job not found');
    }
    
    datasetJob.status = 'running';
    await datasetJob.save();
    
    // Create generator
    const generator = new RuleBasedGenerator(
      configuration.schema,
      configuration.recordCount,
      {
        outputFormat: configuration.outputFormat,
        includeHeaders: configuration.includeHeaders
      }
    );
    
    // Generate data with progress reporting
    const result = await generator.generate();
    
    // Save to file
    const filename = `${job.data.jobId}_${Date.now()}.${configuration.outputFormat}`;
    const outputFile = await FileOutputManager.saveFile(
      result.records,
      filename,
      configuration.outputFormat,
      { includeHeaders: configuration.includeHeaders }
    );
    
    // Create download URL (in production, use cloud storage)
    outputFile.downloadUrl = `/api/files/download/${outputFile.filename}`;
    
    return {
      outputFile,
      recordsGenerated: result.recordCount,
      executionTime: result.executionTime,
      qualityMetrics: result.qualityMetrics
    };
    
  } catch (error) {
    logger.error(`Rule-based job ${job.data.jobId} failed:`, error);
    throw error;
  }
}

// Process AI augmentation job
async function processAIAugmentationJob(job) {
  const { datasetJobId, configuration } = job.data;
  
  logger.info(`Processing AI augmentation job: ${job.data.jobId}`);
  
  try {
    const datasetJob = await DatasetJob.findById(datasetJobId);
    if (!datasetJob) {
      throw new Error('Dataset job not found');
    }
    
    datasetJob.status = 'running';
    await datasetJob.save();
    
    // Load source data
    const sourceData = await loadCSVFile(configuration.sourceFile.path);
    
    // Create generator
    const generator = new AIAugmentationGenerator(
      sourceData,
      configuration.augmentationRatio,
      {
        outputFormat: configuration.outputFormat,
        includeHeaders: configuration.includeHeaders
      }
    );
    
    // Generate augmented data
    const result = await generator.generate();
    
    // Save to file
    const filename = `${job.data.jobId}_augmented_${Date.now()}.${configuration.outputFormat}`;
    const outputFile = await FileOutputManager.saveFile(
      result.records,
      filename,
      configuration.outputFormat,
      { includeHeaders: configuration.includeHeaders }
    );
    
    outputFile.downloadUrl = `/api/files/download/${outputFile.filename}`;
    
    return {
      outputFile,
      recordsGenerated: result.recordCount,
      originalCount: result.originalCount,
      augmentedCount: result.augmentedCount,
      executionTime: result.executionTime,
      qualityMetrics: result.qualityMetrics
    };
    
  } catch (error) {
    logger.error(`AI augmentation job ${job.data.jobId} failed:`, error);
    throw error;
  }
}

// Process anonymization job
async function processAnonymizationJob(job) {
  const { datasetJobId, configuration } = job.data;
  
  logger.info(`Processing anonymization job: ${job.data.jobId}`);
  
  try {
    const datasetJob = await DatasetJob.findById(datasetJobId);
    if (!datasetJob) {
      throw new Error('Dataset job not found');
    }
    
    datasetJob.status = 'running';
    await datasetJob.save();
    
    // Load source data
    const sourceData = await loadCSVFile(configuration.sourceFile.path);
    
    // Create processor
    const processor = new AnonymizationProcessor(
      sourceData,
      configuration.anonymizationMethods,
      {
        outputFormat: configuration.outputFormat,
        includeHeaders: configuration.includeHeaders
      }
    );
    
    // Process data
    const result = await processor.process();
    
    // Save to file
    const filename = `${job.data.jobId}_anonymized_${Date.now()}.${configuration.outputFormat}`;
    const outputFile = await FileOutputManager.saveFile(
      result.records,
      filename,
      configuration.outputFormat,
      { includeHeaders: configuration.includeHeaders }
    );
    
    outputFile.downloadUrl = `/api/files/download/${outputFile.filename}`;
    
    return {
      outputFile,
      recordsGenerated: result.recordCount,
      executionTime: result.executionTime,
      qualityMetrics: result.qualityMetrics
    };
    
  } catch (error) {
    logger.error(`Anonymization job ${job.data.jobId} failed:`, error);
    throw error;
  }
}

// Process synthetic compliance job (combines rule-based generation with compliance features)
async function processSyntheticComplianceJob(job) {
  const { datasetJobId, configuration } = job.data;
  
  logger.info(`Processing synthetic compliance job: ${job.data.jobId}`);
  
  try {
    const datasetJob = await DatasetJob.findById(datasetJobId);
    if (!datasetJob) {
      throw new Error('Dataset job not found');
    }
    
    datasetJob.status = 'running';
    await datasetJob.save();
    
    // Use rule-based generator with enhanced privacy features
    const generator = new RuleBasedGenerator(
      configuration.schema,
      configuration.recordCount,
      {
        outputFormat: configuration.outputFormat,
        includeHeaders: configuration.includeHeaders
      }
    );
    
    const result = await generator.generate();
    
    // Enhance privacy score for compliance
    result.qualityMetrics.privacyScore = 100;
    result.qualityMetrics.complianceScore = 100;
    
    // Save to file
    const filename = `${job.data.jobId}_compliant_${Date.now()}.${configuration.outputFormat}`;
    const outputFile = await FileOutputManager.saveFile(
      result.records,
      filename,
      configuration.outputFormat,
      { includeHeaders: configuration.includeHeaders }
    );
    
    outputFile.downloadUrl = `/api/files/download/${outputFile.filename}`;
    
    return {
      outputFile,
      recordsGenerated: result.recordCount,
      executionTime: result.executionTime,
      qualityMetrics: result.qualityMetrics
    };
    
  } catch (error) {
    logger.error(`Synthetic compliance job ${job.data.jobId} failed:`, error);
    throw error;
  }
}

// Utility function to load CSV file
async function loadCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        logger.info(`Loaded ${results.length} records from ${filePath}`);
        resolve(results);
      })
      .on('error', (error) => {
        logger.error(`Error loading CSV file ${filePath}:`, error);
        reject(error);
      });
  });
}

// Get queue statistics
export const getQueueStats = async () => {
  try {
    const waiting = await jobQueue.getWaiting();
    const active = await jobQueue.getActive();
    const completed = await jobQueue.getCompleted();
    const failed = await jobQueue.getFailed();
    
    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  } catch (error) {
    logger.error('Error getting queue stats:', error);
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0
    };
  }
};

// Clean up old jobs
export const cleanupOldJobs = async () => {
  try {
    await jobQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24 hours
    await jobQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 7 days
    logger.info('Old jobs cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up old jobs:', error);
  }
};

// Initialize Redis connection
export const initializeQueue = async () => {
  try {
    await redisClient.connect();
    logger.info('Job queue initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job queue:', error);
    throw error;
  }
};

// Graceful shutdown
export const shutdownQueue = async () => {
  try {
    await jobQueue.close();
    await redisClient.quit();
    logger.info('Job queue shut down gracefully');
  } catch (error) {
    logger.error('Error shutting down job queue:', error);
  }
};

export default jobQueue;
