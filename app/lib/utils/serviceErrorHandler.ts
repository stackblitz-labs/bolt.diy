export interface ServiceError {
  code?: string;
  message: string;
  details?: any;
  service: string;
  operation: string;
}
