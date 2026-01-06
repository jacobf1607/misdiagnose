#!/usr/bin/env ts-node
/**
 * CLI script to set test user status
 *
 * Usage:
 *   npm run set-test-user <username> true   # Make user a test user
 *   npm run set-test-user <username> false  # Remove test user status
 */

import { setTestUser, getUserByUsername } from '../services/userService';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: npm run set-test-user <username> <true|false>');
  console.log('');
  console.log('Examples:');
  console.log('  npm run set-test-user john_doe true   # Make john_doe a test user');
  console.log('  npm run set-test-user john_doe false  # Remove test user status');
  process.exit(1);
}

const username = args[0];
const isTestUser = args[1].toLowerCase() === 'true';

// Check if user exists first
const existingUser = getUserByUsername(username);
if (!existingUser) {
  console.error(`Error: User "${username}" not found.`);
  console.log('');
  console.log('Make sure the user has logged in at least once to create their account.');
  process.exit(1);
}

// Set test user status
const updatedUser = setTestUser(username, isTestUser);

if (updatedUser) {
  console.log('');
  console.log('Success!');
  console.log(`  Username: ${updatedUser.username}`);
  console.log(`  Test User: ${updatedUser.is_test_user ? 'Yes' : 'No'}`);
  console.log('');
  if (isTestUser) {
    console.log('This user can now access Test Mode from the Dashboard.');
  } else {
    console.log('Test Mode access has been removed for this user.');
  }
} else {
  console.error('Failed to update user.');
  process.exit(1);
}
