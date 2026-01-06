#!/bin/sh

# Entrypoint script for Railway with persistent volume
# The volume mounts OVER /app/dist/data, so on first deploy it's empty
# This script copies initial data if the volume is empty

DATA_DIR="/app/dist/data"
BACKUP_DIR="/app/data-init"

# Check if data directory is empty (first deploy with volume)
if [ -d "$DATA_DIR" ] && [ -z "$(ls -A $DATA_DIR 2>/dev/null)" ]; then
    echo "[Entrypoint] Volume is empty, copying initial data..."
    cp -r $BACKUP_DIR/* $DATA_DIR/
    echo "[Entrypoint] Initial data copied successfully"
elif [ ! -d "$DATA_DIR" ]; then
    echo "[Entrypoint] Creating data directory..."
    mkdir -p $DATA_DIR
    cp -r $BACKUP_DIR/* $DATA_DIR/
    echo "[Entrypoint] Initial data copied successfully"
else
    echo "[Entrypoint] Data directory exists with content, using existing data"
fi

# REFRESH_CASES=true will update cases from backup while keeping user data
if [ "$REFRESH_CASES" = "true" ]; then
    echo "[Entrypoint] REFRESH_CASES=true, updating cases folder..."
    if [ -d "$BACKUP_DIR/cases" ]; then
        rm -rf $DATA_DIR/cases
        cp -r $BACKUP_DIR/cases $DATA_DIR/
        echo "[Entrypoint] Cases refreshed from backup (user data preserved)"
    else
        echo "[Entrypoint] Warning: No cases backup found at $BACKUP_DIR/cases"
    fi
fi

# Start the server
echo "[Entrypoint] Starting server..."
exec npm start
