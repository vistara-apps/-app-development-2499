import mongoose from 'mongoose';

const datasetJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    unique: true,
    default: function() {
      return `job_${new mongoose.Types.ObjectId().toString()}`;
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  name: {
    type: String,
    required: [true, 'Job name is required'],
    trim: true,
    maxlength: [100, 'Job name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  jobType: {
    type: String,
    enum: ['rule-based', 'ai-augmentation', 'anonymization', 'synthetic-compliance'],
    required: [true, 'Job type is required']
  },
  status: {
    type: String,
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
    default: 'queued'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  configuration: {
    // Rule-based configuration
    schema: [{
      name: String,
      type: String,
      constraints: String,
      required: Boolean
    }],
    recordCount: {
      type: Number,
      min: 1,
      max: 1000000,
      default: 1000
    },
    
    // AI Augmentation configuration
    sourceFile: {
      filename: String,
      originalName: String,
      size: Number,
      mimetype: String,
      path: String
    },
    augmentationRatio: {
      type: Number,
      min: 0.1,
      max: 10,
      default: 1
    },
    
    // Anonymization configuration
    anonymizationMethods: [{
      field: String,
      method: {
        type: String,
        enum: ['mask', 'hash', 'generalize', 'suppress', 'pseudonymize']
      },
      parameters: mongoose.Schema.Types.Mixed
    }],
    
    // Common configuration
    outputFormat: {
      type: String,
      enum: ['csv', 'json', 'xlsx', 'parquet'],
      default: 'csv'
    },
    includeHeaders: {
      type: Boolean,
      default: true
    }
  },
  results: {
    outputFile: {
      filename: String,
      originalName: String,
      size: Number,
      path: String,
      downloadUrl: String
    },
    recordsGenerated: {
      type: Number,
      default: 0
    },
    executionTime: {
      type: Number, // in milliseconds
      default: 0
    },
    qualityMetrics: {
      dataQualityScore: Number,
      privacyScore: Number,
      diversityScore: Number
    }
  },
  error: {
    message: String,
    code: String,
    details: mongoose.Schema.Types.Mixed,
    timestamp: Date
  },
  startedAt: Date,
  completedAt: Date,
  expiresAt: {
    type: Date,
    default: function() {
      // Files expire after 30 days by default
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for job duration
datasetJobSchema.virtual('duration').get(function() {
  if (this.startedAt && this.completedAt) {
    return this.completedAt - this.startedAt;
  }
  return null;
});

// Virtual for time remaining until expiry
datasetJobSchema.virtual('timeUntilExpiry').get(function() {
  if (this.expiresAt) {
    return Math.max(0, this.expiresAt - Date.now());
  }
  return null;
});

// Virtual for human-readable status
datasetJobSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'queued': 'Queued',
    'running': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled'
  };
  return statusMap[this.status] || this.status;
});

// Indexes for better query performance
datasetJobSchema.index({ userId: 1, createdAt: -1 });
datasetJobSchema.index({ status: 1, createdAt: -1 });
datasetJobSchema.index({ jobType: 1 });
datasetJobSchema.index({ expiresAt: 1 });
datasetJobSchema.index({ jobId: 1 });

// Pre-save middleware to update timestamps
datasetJobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set startedAt when status changes to running
  if (this.isModified('status') && this.status === 'running' && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Set completedAt when status changes to completed or failed
  if (this.isModified('status') && ['completed', 'failed', 'cancelled'].includes(this.status) && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Instance method to update progress
datasetJobSchema.methods.updateProgress = function(progress, status = null) {
  this.progress = Math.min(100, Math.max(0, progress));
  if (status) {
    this.status = status;
  }
  return this.save();
};

// Instance method to mark as failed
datasetJobSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    details: error.details || null,
    timestamp: new Date()
  };
  this.progress = 0;
  return this.save();
};

// Instance method to mark as completed
datasetJobSchema.methods.markAsCompleted = function(results) {
  this.status = 'completed';
  this.progress = 100;
  if (results) {
    this.results = { ...this.results, ...results };
  }
  return this.save();
};

// Static method to find jobs by user
datasetJobSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.jobType) {
    query.where('jobType').equals(options.jobType);
  }
  
  return query.sort({ createdAt: -1 }).limit(options.limit || 50);
};

// Static method to find expired jobs
datasetJobSchema.statics.findExpired = function() {
  return this.find({
    expiresAt: { $lt: new Date() },
    status: 'completed'
  });
};

export default mongoose.model('DatasetJob', datasetJobSchema);
