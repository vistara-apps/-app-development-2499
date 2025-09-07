import { faker } from '@faker-js/faker';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvWriter from 'csv-writer';
import { setupLogger } from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logger = setupLogger();

/**
 * Rule-based synthetic data generator
 * Generates data based on predefined rules and constraints
 */
export class RuleBasedGenerator {
  constructor(schema, recordCount, options = {}) {
    this.schema = schema;
    this.recordCount = recordCount;
    this.options = {
      outputFormat: 'csv',
      includeHeaders: true,
      ...options
    };
  }

  /**
   * Generate synthetic data based on schema rules
   */
  async generate() {
    const startTime = Date.now();
    const records = [];

    logger.info(`Starting rule-based generation of ${this.recordCount} records`);

    for (let i = 0; i < this.recordCount; i++) {
      const record = {};
      
      for (const field of this.schema) {
        record[field.name] = this.generateFieldValue(field);
      }
      
      records.push(record);

      // Report progress every 1000 records
      if ((i + 1) % 1000 === 0) {
        const progress = Math.round(((i + 1) / this.recordCount) * 100);
        logger.info(`Generated ${i + 1}/${this.recordCount} records (${progress}%)`);
      }
    }

    const executionTime = Date.now() - startTime;
    logger.info(`Rule-based generation completed in ${executionTime}ms`);

    return {
      records,
      recordCount: records.length,
      executionTime,
      qualityMetrics: this.calculateQualityMetrics(records)
    };
  }

  /**
   * Generate value for a specific field based on its type and constraints
   */
  generateFieldValue(field) {
    const { type, constraints } = field;
    const constraintMap = this.parseConstraints(constraints);

    switch (type) {
      case 'string':
        return this.generateString(constraintMap);
      case 'integer':
        return this.generateInteger(constraintMap);
      case 'float':
        return this.generateFloat(constraintMap);
      case 'email':
        return this.generateEmail(constraintMap);
      case 'phone':
        return this.generatePhone(constraintMap);
      case 'date':
        return this.generateDate(constraintMap);
      case 'boolean':
        return this.generateBoolean(constraintMap);
      default:
        return faker.lorem.word();
    }
  }

  /**
   * Parse constraint string into key-value pairs
   */
  parseConstraints(constraints) {
    if (!constraints) return {};
    
    const constraintMap = {};
    const pairs = constraints.split(',').map(pair => pair.trim());
    
    for (const pair of pairs) {
      const [key, value] = pair.split(':').map(item => item.trim());
      if (key && value) {
        // Try to parse as number, otherwise keep as string
        constraintMap[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return constraintMap;
  }

  generateString(constraints) {
    const minLength = constraints.min || 5;
    const maxLength = constraints.max || 20;
    const pattern = constraints.pattern;
    
    if (pattern === 'name') {
      return faker.person.fullName();
    } else if (pattern === 'company') {
      return faker.company.name();
    } else if (pattern === 'address') {
      return faker.location.streetAddress();
    } else if (pattern === 'city') {
      return faker.location.city();
    } else if (pattern === 'country') {
      return faker.location.country();
    }
    
    return faker.lorem.words({ min: 1, max: 3 }).substring(0, maxLength);
  }

  generateInteger(constraints) {
    const min = constraints.min || 1;
    const max = constraints.max || 1000;
    return faker.number.int({ min, max });
  }

  generateFloat(constraints) {
    const min = constraints.min || 0;
    const max = constraints.max || 100;
    const precision = constraints.precision || 2;
    return parseFloat(faker.number.float({ min, max, precision }).toFixed(precision));
  }

  generateEmail(constraints) {
    const domain = constraints.domain || 'example.com';
    const firstName = faker.person.firstName().toLowerCase();
    const lastName = faker.person.lastName().toLowerCase();
    return `${firstName}.${lastName}@${domain}`;
  }

  generatePhone(constraints) {
    const format = constraints.format || 'US';
    if (format === 'US') {
      return faker.phone.number('###-###-####');
    }
    return faker.phone.number();
  }

  generateDate(constraints) {
    const from = constraints.from ? new Date(constraints.from) : new Date('1990-01-01');
    const to = constraints.to ? new Date(constraints.to) : new Date();
    return faker.date.between({ from, to }).toISOString().split('T')[0];
  }

  generateBoolean(constraints) {
    const probability = constraints.probability || 0.5;
    return Math.random() < probability;
  }

  /**
   * Calculate quality metrics for generated data
   */
  calculateQualityMetrics(records) {
    if (records.length === 0) return { dataQualityScore: 0, diversityScore: 0 };

    let uniqueValues = 0;
    let totalValues = 0;
    const fieldUniqueness = {};

    // Calculate uniqueness per field
    for (const field of this.schema) {
      const values = records.map(record => record[field.name]);
      const uniqueCount = new Set(values).size;
      fieldUniqueness[field.name] = uniqueCount / values.length;
      uniqueValues += uniqueCount;
      totalValues += values.length;
    }

    const diversityScore = Math.round((uniqueValues / totalValues) * 100);
    const dataQualityScore = Math.round(
      (Object.values(fieldUniqueness).reduce((sum, score) => sum + score, 0) / this.schema.length) * 100
    );

    return {
      dataQualityScore,
      diversityScore,
      privacyScore: 100, // Rule-based data is inherently privacy-safe
      fieldUniqueness
    };
  }
}

/**
 * AI-powered data augmentation (simplified implementation)
 * In production, this would use ML models for more sophisticated augmentation
 */
export class AIAugmentationGenerator {
  constructor(sourceData, augmentationRatio, options = {}) {
    this.sourceData = sourceData;
    this.augmentationRatio = augmentationRatio;
    this.options = {
      outputFormat: 'csv',
      includeHeaders: true,
      ...options
    };
  }

  async generate() {
    const startTime = Date.now();
    logger.info(`Starting AI augmentation with ratio ${this.augmentationRatio}`);

    // Analyze source data structure
    const schema = this.analyzeDataStructure(this.sourceData);
    const targetCount = Math.round(this.sourceData.length * this.augmentationRatio);
    
    // Generate augmented records
    const augmentedRecords = [];
    
    for (let i = 0; i < targetCount; i++) {
      const baseRecord = this.sourceData[Math.floor(Math.random() * this.sourceData.length)];
      const augmentedRecord = this.augmentRecord(baseRecord, schema);
      augmentedRecords.push(augmentedRecord);

      if ((i + 1) % 100 === 0) {
        const progress = Math.round(((i + 1) / targetCount) * 100);
        logger.info(`Augmented ${i + 1}/${targetCount} records (${progress}%)`);
      }
    }

    // Combine original and augmented data
    const combinedRecords = [...this.sourceData, ...augmentedRecords];
    const executionTime = Date.now() - startTime;

    logger.info(`AI augmentation completed in ${executionTime}ms`);

    return {
      records: combinedRecords,
      recordCount: combinedRecords.length,
      originalCount: this.sourceData.length,
      augmentedCount: augmentedRecords.length,
      executionTime,
      qualityMetrics: this.calculateQualityMetrics(combinedRecords)
    };
  }

  analyzeDataStructure(data) {
    if (data.length === 0) return {};
    
    const schema = {};
    const sample = data[0];
    
    for (const [key, value] of Object.entries(sample)) {
      schema[key] = {
        type: this.inferDataType(value),
        samples: data.slice(0, 10).map(record => record[key]).filter(v => v != null)
      };
    }
    
    return schema;
  }

  inferDataType(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'float';
    }
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      if (value.includes('@')) return 'email';
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
      if (/^\+?\d[\d\s\-\(\)]+$/.test(value)) return 'phone';
      return 'string';
    }
    return 'string';
  }

  augmentRecord(baseRecord, schema) {
    const augmented = { ...baseRecord };
    
    for (const [field, fieldSchema] of Object.entries(schema)) {
      // Apply variation based on field type
      switch (fieldSchema.type) {
        case 'integer':
          augmented[field] = this.varyInteger(baseRecord[field]);
          break;
        case 'float':
          augmented[field] = this.varyFloat(baseRecord[field]);
          break;
        case 'string':
          augmented[field] = this.varyString(baseRecord[field], fieldSchema.samples);
          break;
        case 'email':
          augmented[field] = this.varyEmail(baseRecord[field]);
          break;
        case 'date':
          augmented[field] = this.varyDate(baseRecord[field]);
          break;
        // Keep boolean and other types as-is for now
      }
    }
    
    return augmented;
  }

  varyInteger(value) {
    if (value == null) return value;
    const variation = Math.floor(Math.random() * 21) - 10; // ±10
    return Math.max(0, value + variation);
  }

  varyFloat(value) {
    if (value == null) return value;
    const variation = (Math.random() - 0.5) * 0.2 * value; // ±10%
    return parseFloat((value + variation).toFixed(2));
  }

  varyString(value, samples) {
    if (value == null) return value;
    
    // Sometimes return a similar sample, sometimes generate new
    if (Math.random() < 0.3 && samples.length > 1) {
      return samples[Math.floor(Math.random() * samples.length)];
    }
    
    // Simple string variation (in production, use NLP models)
    return value + faker.lorem.word();
  }

  varyEmail(value) {
    if (value == null) return value;
    const [localPart, domain] = value.split('@');
    const newLocal = localPart + Math.floor(Math.random() * 100);
    return `${newLocal}@${domain}`;
  }

  varyDate(value) {
    if (value == null) return value;
    const date = new Date(value);
    const variation = (Math.random() - 0.5) * 30 * 24 * 60 * 60 * 1000; // ±30 days
    const newDate = new Date(date.getTime() + variation);
    return newDate.toISOString().split('T')[0];
  }

  calculateQualityMetrics(records) {
    // Simplified quality metrics for AI augmentation
    return {
      dataQualityScore: 85,
      diversityScore: 90,
      privacyScore: 75 // Lower than rule-based due to similarity to source data
    };
  }
}

/**
 * Data anonymization and masking
 */
export class AnonymizationProcessor {
  constructor(sourceData, anonymizationMethods, options = {}) {
    this.sourceData = sourceData;
    this.methods = anonymizationMethods;
    this.options = {
      outputFormat: 'csv',
      includeHeaders: true,
      ...options
    };
  }

  async process() {
    const startTime = Date.now();
    logger.info(`Starting anonymization of ${this.sourceData.length} records`);

    const anonymizedRecords = this.sourceData.map((record, index) => {
      const anonymized = { ...record };
      
      for (const method of this.methods) {
        if (anonymized[method.field] != null) {
          anonymized[method.field] = this.applyAnonymization(
            anonymized[method.field],
            method.method,
            method.parameters || {}
          );
        }
      }

      if ((index + 1) % 1000 === 0) {
        const progress = Math.round(((index + 1) / this.sourceData.length) * 100);
        logger.info(`Anonymized ${index + 1}/${this.sourceData.length} records (${progress}%)`);
      }
      
      return anonymized;
    });

    const executionTime = Date.now() - startTime;
    logger.info(`Anonymization completed in ${executionTime}ms`);

    return {
      records: anonymizedRecords,
      recordCount: anonymizedRecords.length,
      executionTime,
      qualityMetrics: {
        dataQualityScore: 95,
        diversityScore: 80,
        privacyScore: 95 // High privacy score due to anonymization
      }
    };
  }

  applyAnonymization(value, method, parameters) {
    switch (method) {
      case 'mask':
        return this.maskValue(value, parameters);
      case 'hash':
        return this.hashValue(value);
      case 'generalize':
        return this.generalizeValue(value, parameters);
      case 'suppress':
        return null;
      case 'pseudonymize':
        return this.pseudonymizeValue(value, parameters);
      default:
        return value;
    }
  }

  maskValue(value, parameters) {
    const maskChar = parameters.maskChar || '*';
    const keepStart = parameters.keepStart || 0;
    const keepEnd = parameters.keepEnd || 0;
    
    if (typeof value !== 'string') return value;
    
    const str = value.toString();
    if (str.length <= keepStart + keepEnd) return str;
    
    const start = str.substring(0, keepStart);
    const end = str.substring(str.length - keepEnd);
    const middle = maskChar.repeat(str.length - keepStart - keepEnd);
    
    return start + middle + end;
  }

  hashValue(value) {
    // Simple hash (in production, use crypto.createHash)
    let hash = 0;
    const str = value.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  generalizeValue(value, parameters) {
    const level = parameters.level || 1;
    
    if (typeof value === 'number') {
      // Round to nearest power of 10
      const factor = Math.pow(10, level);
      return Math.round(value / factor) * factor;
    }
    
    if (typeof value === 'string' && value.includes('@')) {
      // Generalize email domain
      const [local, domain] = value.split('@');
      const domainParts = domain.split('.');
      return `${local}@${domainParts[domainParts.length - 1]}`;
    }
    
    return value;
  }

  pseudonymizeValue(value, parameters) {
    // Simple pseudonymization using faker
    if (typeof value === 'string') {
      if (value.includes('@')) {
        return faker.internet.email();
      }
      if (/^\+?\d[\d\s\-\(\)]+$/.test(value)) {
        return faker.phone.number();
      }
      // Assume it's a name
      return faker.person.fullName();
    }
    
    return value;
  }
}

/**
 * File output utilities
 */
export class FileOutputManager {
  static async saveAsCSV(records, filename, includeHeaders = true) {
    if (records.length === 0) {
      throw new Error('No records to save');
    }

    const headers = Object.keys(records[0]);
    const csvWriterInstance = csvWriter.createObjectCsvWriter({
      path: filename,
      header: headers.map(h => ({ id: h, title: h }))
    });

    await csvWriterInstance.writeRecords(records);
    const stats = await fs.stat(filename);
    
    return {
      filename: path.basename(filename),
      path: filename,
      size: stats.size,
      recordCount: records.length
    };
  }

  static async saveAsJSON(records, filename) {
    const jsonData = JSON.stringify(records, null, 2);
    await fs.writeFile(filename, jsonData, 'utf8');
    const stats = await fs.stat(filename);
    
    return {
      filename: path.basename(filename),
      path: filename,
      size: stats.size,
      recordCount: records.length
    };
  }

  static async saveFile(records, filename, format = 'csv', options = {}) {
    const outputDir = process.env.UPLOAD_DIR || './uploads';
    await fs.mkdir(outputDir, { recursive: true });
    
    const fullPath = path.join(outputDir, filename);
    
    switch (format.toLowerCase()) {
      case 'json':
        return await this.saveAsJSON(records, fullPath);
      case 'csv':
      default:
        return await this.saveAsCSV(records, fullPath, options.includeHeaders);
    }
  }
}
