import { deleteExpiredCharactersJob } from './characters';

export default function startJobs() {
  console.log('Starting background jobs...')
  deleteExpiredCharactersJob.start();
}
