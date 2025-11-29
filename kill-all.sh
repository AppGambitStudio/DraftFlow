#!/bin/bash
echo "Killing all node processes..."
pkill -f "node"
pkill -f "next"
pkill -f "ts-node"
echo "All node/next/ts-node processes killed."
