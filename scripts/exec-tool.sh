#!/bin/bash -l
# Runs a command in a login shell context.
# Required for commands that need a login shell context
# (e.g., PATH setup, tool configs).
#
# Usage: exec-tool.sh 'cat /tmp/prompt.md | command args 2>&1'
eval "$1"
