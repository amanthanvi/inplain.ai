#!/usr/bin/env bash
template=$1
shift
claude run prompts/$template "$@"
