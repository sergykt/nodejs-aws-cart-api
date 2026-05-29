import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '../order/order.module';

import { CartController } from './cart.controller';
import { CartEntity, CartItemEntity } from './entities';
import { CartService } from './services';

@Module({
  imports: [
    OrderModule,
    TypeOrmModule.forFeature([CartEntity, CartItemEntity]),
  ],
  providers: [CartService],
  controllers: [CartController],
})
export class CartModule {}
