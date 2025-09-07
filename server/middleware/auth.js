import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { setupLogger } from '../config/logger.js';

const logger = setupLogger();

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Verify JWT token and authenticate user
export const authenticate = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (if using cookie-based auth)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token is valid but user not found.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account has been deactivated.'
        });
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (tokenError) {
      logger.error('Token verification failed:', tokenError);
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

// Check if user has required subscription tier
export const requireSubscription = (requiredTiers = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // If no specific tiers required, just check if user has active subscription
    if (requiredTiers.length === 0) {
      if (req.user.subscriptionStatus !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Active subscription required.'
        });
      }
      return next();
    }

    // Check if user has one of the required subscription tiers
    if (!requiredTiers.includes(req.user.subscriptionTier)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${requiredTiers.join(' or ')} subscription.`,
        requiredTiers,
        currentTier: req.user.subscriptionTier
      });
    }

    // Check if subscription is active
    if (req.user.subscriptionStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Active subscription required.'
      });
    }

    next();
  };
};

// Check if user can create jobs (based on usage limits)
export const checkJobLimits = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const canCreate = req.user.canCreateJob();
    
    if (!canCreate.allowed) {
      return res.status(403).json({
        success: false,
        message: canCreate.reason,
        limits: req.user.subscriptionLimits,
        currentUsage: req.user.dataUsage
      });
    }

    next();
  } catch (error) {
    logger.error('Job limits check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking job limits.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (tokenError) {
        // Token is invalid, but we don't fail the request
        logger.warn('Invalid token in optional auth:', tokenError.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

// Admin role check (for future admin features)
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.'
    });
  }

  next();
};
