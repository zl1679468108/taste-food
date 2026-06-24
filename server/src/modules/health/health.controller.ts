import { Controller, Get } from '@nestjs/common';
import { success, ApiResponse } from '../../common/interfaces/api-response.interface';
import { hasSupabase } from '../../database/supabase.client';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  database: string;
  version: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): ApiResponse<HealthStatus> {
    return success({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: hasSupabase() ? 'supabase' : 'memory',
      version: '1.0.0',
    });
  }
}