import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartStatuses } from '../models';
import { PutCartPayload } from 'src/order/type';
import { CartEntity, CartItemEntity } from '../entities';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,
  ) {}

  private mapToCart(cart: CartEntity, items: CartItemEntity[]): Cart {
    return {
      id: cart.id,
      user_id: cart.userId,
      status: cart.status,
      created_at: Number(cart.createdAt),
      updated_at: Number(cart.updatedAt),
      items: items.map((item) => ({
        count: item.count,
        product: {
          id: item.productId,
          title: item.title,
          description: item.description,
          price: item.price,
        },
      })),
    };
  }

  async findByUserId(userId: string): Promise<Cart | null> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
    });

    if (!cart) {
      return null;
    }

    const items = await this.cartItemRepository.find({
      where: { cartId: cart.id },
    });

    return this.mapToCart(cart, items);
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const timestamp = Date.now();

    const userCart = this.cartRepository.create({
      userId: user_id,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: CartStatuses.OPEN,
    });

    const savedCart = await this.cartRepository.save(userCart);

    return this.mapToCart(savedCart, []);
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const userCart = await this.findOrCreateByUserId(userId);

    const existingItem = await this.cartItemRepository.findOne({
      where: {
        cartId: userCart.id,
        productId: payload.product.id,
      },
    });

    if (payload.count === 0) {
      if (existingItem) {
        await this.cartItemRepository.delete({
          cartId: userCart.id,
          productId: payload.product.id,
        });
      }
    } else if (!existingItem) {
      await this.cartItemRepository.save(
        this.cartItemRepository.create({
          cartId: userCart.id,
          productId: payload.product.id,
          title: payload.product.title,
          description: payload.product.description,
          price: payload.product.price,
          count: payload.count,
        }),
      );
    } else {
      await this.cartItemRepository.update(
        {
          cartId: userCart.id,
          productId: payload.product.id,
        },
        {
          title: payload.product.title,
          description: payload.product.description,
          price: payload.product.price,
          count: payload.count,
        },
      );
    }

    await this.cartRepository.update(
      { id: userCart.id },
      { updatedAt: Date.now() },
    );

    return this.findOrCreateByUserId(userId);
  }

  async removeByUserId(userId: string): Promise<void> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
    });

    if (!cart) {
      return;
    }

    await this.cartItemRepository.delete({ cartId: cart.id });
    await this.cartRepository.delete({ id: cart.id });
  }
}
