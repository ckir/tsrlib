# Setup Guide for tsrlib

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ckir/tsrlib.git
   cd tsrlib
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Binary Setup
1. Build the project:
   ```bash
   npm run build
   ```
2. Install the binary globally (optional):
   ```bash
   npm install -g ./dist
   ```

## Configuration
1. Create a configuration file `config.json` in the root directory. Example configuration:
   ```json
   {
     "option1": "value1",
     "option2": "value2"
   }
   ```
2. Ensure the settings match your environment requirements.

## Basic Usage Examples
1. Run the binary:
   ```bash
   tsrlib --config config.json
   ```
2. Example command with options:
   ```bash
   tsrlib --option1 value
   ```

For more detailed usage, refer to the official documentation or help command: `tsrlib --help`.
