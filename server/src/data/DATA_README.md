# Data Directory Structure

This directory contains all persistent data for the Misdiagnose application.

## Files

### `cases/`
- `pool-index.json` - Index of all available cases
- `case_*.json` - Individual pre-generated medical cases

### `users/`
- `users.json` - User profiles and case history

### Root files
- `challenges.json` - Challenge data for friend competitions
- `notifications.json` - User notifications
- `feedback.json` - User feedback submissions

## Fresh Deployment

On a fresh deployment, if files don't exist:
- `users.json` - Created automatically on first user registration
- `challenges.json` - Created automatically on first challenge
- `notifications.json` - Created automatically on first notification
- `feedback.json` - Created automatically on first feedback

## Railway Volumes

In Railway, you should attach a volume to `/app/src/data` to persist data between deployments.

## Backup

For production, consider backing up:
- `users/users.json` (user data)
- `challenges.json` (active challenges)
