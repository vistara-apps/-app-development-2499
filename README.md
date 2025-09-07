# SampleShield Pro

**Generate compliant, privacy-preserving synthetic data for AI development.**

SampleShield Pro is a comprehensive web application that generates secure and privacy-compliant synthetic datasets for AI developers and businesses concerned with data privacy and regulatory compliance.

## 🚀 Features

### Core Capabilities

- **Rule-Based Data Generation**: Define specific rules and constraints to generate structured synthetic data samples with precise control over data types, value ranges, and distributions.

- **AI-Powered Data Augmentation**: Utilize AI models to enrich existing datasets by creating realistic synthetic variations, improving model training robustness.

- **Anonymization & Masking Tools**: Apply advanced anonymization and masking techniques (k-anonymity, differential privacy, PII masking) to sensitive fields within datasets.

- **Synthetic Data for Compliance**: Generate entirely synthetic datasets that mimic statistical properties of real-world data without using any actual personal information, ensuring GDPR, CCPA, and HIPAA compliance.

### Technical Features

- **Subscription-Based Access**: Tiered pricing model with different data volume limits and feature access
- **Real-time Job Processing**: Asynchronous job queue system with progress tracking
- **Multiple Output Formats**: Support for CSV, JSON, and Excel file formats
- **Quality Metrics**: Comprehensive data quality, privacy, and diversity scoring
- **Usage Analytics**: Detailed dashboard with performance and usage insights

## 🏗️ Architecture

### Frontend (React + Vite)
- Modern React application with Vite for fast development
- Tailwind CSS for responsive, professional UI design
- Component-based architecture with reusable UI elements
- Real-time updates and progress tracking

### Backend (Node.js + Express)
- RESTful API with Express.js
- MongoDB for data persistence
- Redis for job queue management
- JWT-based authentication and authorization
- Comprehensive logging and error handling

### Data Processing Engine
- Rule-based synthetic data generation using Faker.js
- AI-powered data augmentation algorithms
- Advanced anonymization and privacy protection methods
- Scalable job processing with Bull queue system

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm 8+
- MongoDB 5.0+
- Redis 6.0+

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/vistara-apps/-app-development-2499.git
   cd -app-development-2499
   ```

2. **Install all dependencies**
   ```bash
   npm run install:all
   ```

3. **Environment Setup**
   
   Create `.env` file in the server directory:
   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=5000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/sampleshield-pro
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=7d
   
   # File Upload
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=104857600
   
   # Logging
   LOG_LEVEL=info
   LOG_DIR=./logs
   ```

4. **Start the development servers**
   ```bash
   npm run dev:full
   ```

   This will start both the frontend (http://localhost:5173) and backend (http://localhost:5000) servers concurrently.

### Individual Server Commands

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run server:dev
```

## 🔧 Configuration

### Subscription Tiers

The application supports three subscription tiers:

- **Basic ($49/month)**: 1GB data limit, basic features
- **Pro ($99/month)**: 5GB data limit, AI augmentation, advanced anonymization
- **Enterprise (Custom)**: Unlimited data, all features, priority support

### Job Types

1. **Rule-Based Generation**: Create synthetic data from scratch using defined schemas
2. **AI Augmentation**: Enhance existing datasets with AI-generated variations
3. **Anonymization**: Apply privacy-preserving techniques to sensitive data
4. **Synthetic Compliance**: Generate fully compliant synthetic datasets

## 📊 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Job Management Endpoints

- `POST /api/jobs` - Create new data generation job
- `GET /api/jobs` - List user's jobs with pagination
- `GET /api/jobs/:jobId` - Get specific job details
- `DELETE /api/jobs/:jobId` - Cancel/delete a job
- `GET /api/jobs/stats/summary` - Get job statistics

### File Management Endpoints

- `POST /api/files/upload` - Upload source data files
- `GET /api/files/download/:filename` - Download generated files
- `GET /api/files/preview/:filename` - Preview file contents
- `DELETE /api/files/:filename` - Delete uploaded files

### Analytics Endpoints

- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/usage` - Usage statistics
- `GET /api/analytics/performance` - Performance metrics

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive request validation with Joi
- **CORS Protection**: Configurable CORS policies
- **Helmet Security**: Security headers with Helmet.js
- **File Upload Security**: Secure file handling with type validation

## 🚀 Deployment

### Production Build

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm run server:start
   ```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://your-production-db/sampleshield-pro
REDIS_URL=redis://your-production-redis:6379
JWT_SECRET=your-production-jwt-secret
```

### Docker Deployment (Optional)

Create a `Dockerfile` for containerized deployment:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm run install:all

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "run", "server:start"]
```

## 📈 Monitoring and Logging

- **Winston Logging**: Comprehensive logging with daily rotation
- **Morgan HTTP Logging**: HTTP request logging
- **Error Tracking**: Centralized error handling and reporting
- **Performance Metrics**: Job execution time and throughput tracking
- **Usage Analytics**: Detailed user activity and system performance metrics

## 🧪 Testing

Run the test suite:

```bash
# Frontend tests
npm test

# Backend tests
npm run server:test

# Watch mode
npm run server:test:watch
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Email: support@sampleshield.pro
- Documentation: [docs.sampleshield.pro](https://docs.sampleshield.pro)

## 🔄 Changelog

### Version 1.0.0
- Initial release with core synthetic data generation features
- Rule-based data generation engine
- AI-powered data augmentation
- Advanced anonymization tools
- Subscription-based access control
- Comprehensive analytics dashboard
- RESTful API with full documentation

---

**SampleShield Pro** - Empowering AI development with privacy-compliant synthetic data generation.
