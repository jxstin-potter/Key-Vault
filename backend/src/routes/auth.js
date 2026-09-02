import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @access Public
 * @description Create a new account and immediately sign in (returns a
 *   token, no separate login step). Always creates a USER-role account -
 *   there is no way to self-register as ADMIN through this endpoint.
 * @param {string} req.body.email
 * @param {string} req.body.password - Minimum 6 characters; hashed with
 *   bcrypt (cost 12) before storage.
 * @param {string} [req.body.firstName]
 * @param {string} [req.body.lastName]
 * @returns {201} `{ message, user, token }` - `token` is a 7-day JWT.
 * @returns {400} Validation failed, or the email is already registered.
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed' });
  }
});

/**
 * @route GET /api/auth/register
 * @access Public
 * @description Usage hint for anyone who navigates here directly in a browser.
 * @returns {200} `{ message }`.
 */
router.get('/register', (req, res) => {
  res.json({
    message: 'This endpoint is for POST requests only. Please use POST with email, password, firstName, and lastName.'
  });
});

/**
 * @route POST /api/auth/login
 * @access Public
 * @description Authenticate and issue a token.
 *
 *   An unknown email and a wrong password return the exact same status and
 *   message ("Invalid credentials") - distinguishing them would let an
 *   attacker enumerate which emails have accounts before ever guessing a
 *   password, so this is deliberate, not an oversight.
 * @param {string} req.body.email
 * @param {string} req.body.password
 * @returns {200} `{ message, user, token }` - `user` omits the password
 *   hash; `token` is a 7-day JWT.
 * @returns {400} Validation failed (missing/malformed email or password).
 * @returns {401} No account with that email, or the password didn't match -
 *   see the note above on why these are indistinguishable to the caller.
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data (without password)
    const { password: _, ...userData } = user;

    res.json({
      message: 'Login successful',
      user: userData,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
});

/**
 * @route GET /api/auth/login
 * @access Public
 * @description Usage hint for anyone who navigates here directly in a browser.
 * @returns {200} `{ message }`.
 */
router.get('/login', (req, res) => {
  res.json({
    message: 'This endpoint is for POST requests only. Please use POST with email and password.'
  });
});

/**
 * @route GET /api/auth/me
 * @access Authenticated
 * @description Return the caller's own profile - the standard "who am I"
 *   endpoint a client calls on load to check an existing token is still valid.
 * @returns {200} `{ user }`.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user data' });
  }
});

/**
 * @route PUT /api/auth/profile
 * @access Authenticated
 * @description Update the caller's own first/last name. Notably does not
 *   accept email or password changes - those are separate concerns
 *   (password rotation lives in routes/users.js) kept off this endpoint so a
 *   simple profile-edit form can't accidentally touch credentials.
 * @param {string} [req.body.firstName]
 * @param {string} [req.body.lastName]
 * @returns {200} `{ message, user }`.
 * @returns {400} Validation failed.
 */
router.put('/profile', authenticateToken, [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

export default router; 