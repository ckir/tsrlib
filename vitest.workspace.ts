import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/tsdk',           // Added to cover main tsdk/src
  'packages/tsdk/packages/*' // Existing sub-packages 
]);