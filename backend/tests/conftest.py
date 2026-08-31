"""
Pytest configuration and root path resolution for ThermoTrace backend test suite.
"""
import os
import sys

# Ensure root paths are in sys.path
sys.path.insert(0, '/app')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))
