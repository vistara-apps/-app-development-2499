import express from 'express';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import { setupLogger } from '../config/logger.js';

const router = express.Router();
const logger = setupLogger();

// @route   GET /api/users/profile
// @desc    Get user profile (same as /api/auth/me but different endpoint)
// @access  Private
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          userId: req.user.userId,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          fullName: req.user.fullName,
          email: req.user.email,
          subscriptionTier: req.user.subscriptionTier,
          subscriptionStatus: req.user.subscriptionStatus,
          subscriptionLimits: req.user.subscriptionLimits,
          dataUsage: req.user.dataUsage,
          isEmailVerified: req.user.isEmailVerified,
          lastLogin: req.user.lastLogin,
          createdAt: req.user.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    // Validate input
    if (!firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required'
      });
    }

    // Update user
    req.user.firstName = firstName.trim();
    req.user.lastName = lastName.trim();
    await req.user.save();

    logger.info(`User profile updated: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: req.user._id,
          userId: req.user.userId,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          fullName: req.user.fullName,
          email: req.user.email,
          subscriptionTier: req.user.subscriptionTier,
          subscriptionStatus: req.user.subscriptionStatus,
          updatedAt: req.user.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// @route   GET /api/users/usage
// @desc    Get user's data usage statistics
// @access  Private
router.get('/usage', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const limits = user.subscriptionLimits;
    
    // Calculate usage percentage
    const usagePercentage = limits.dataLimit === -1 
      ? 0 
      : Math.round((user.dataUsage.current / limits.dataLimit) * 100);

    res.json({
      success: true,
      data: {
        usage: {
          current: user.dataUsage.current,
          limit: limits.dataLimit,
          percentage: usagePercentage,
          resetDate: user.dataUsage.resetDate,
          subscriptionTier: user.subscriptionTier,
          subscriptionStatus: user.subscriptionStatus,
          limits: limits
        }
      }
    });
  } catch (error) {
    logger.error('Get user usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics'
    });
  }
});

// @route   POST /api/users/reset-usage
// @desc    Reset user's monthly data usage (admin only or for testing)
// @access  Private
router.post('/reset-usage', authenticate, async (req, res) => {
  try {
    // In production, this would be admin-only or automated monthly
    req.user.dataUsage.current = 0;
    req.user.dataUsage.resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    await req.user.save();

    logger.info(`Data usage reset for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Data usage reset successfully',
      data: {
        usage: req.user.dataUsage
      }
    });
  } catch (error) {
    logger.error('Reset usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset usage'
    });
  }
});

export default router;
