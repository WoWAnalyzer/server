import {wipeExpiredCharactersJob} from './characters';

export default function startJobs() {
  console.log('Starting background jobs...');
  wipeExpiredCharactersJob.start();
}
