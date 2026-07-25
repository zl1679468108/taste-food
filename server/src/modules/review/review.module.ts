import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { OrderReviewController, ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [OrderModule],
  controllers: [OrderReviewController, ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}
