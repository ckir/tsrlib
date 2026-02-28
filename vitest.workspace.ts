import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'tsdk-loggers',
    environment: 'node',
  }
}
);