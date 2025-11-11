import { validateProject } from './validation';

if (import.meta.main) {
  validateProject().catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}
