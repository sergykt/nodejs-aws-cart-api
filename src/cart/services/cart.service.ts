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
      created_at: cart.createdAt,
      updated_at: cart.updatedAt,
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
    const userCart = this.cartRepository.create({
      userId: user_id,
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

  private async touchCart(cart: Cart): Promise<void> {
    await this.cartRepository.update({ id: cart.id }, { status: cart.status });
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const userCart = await this.findOrCreateByUserId(userId);

    const { id: cartId } = userCart;
    const { product, count } = payload;

    const existingItem = await this.cartItemRepository.findOne({
      where: { cartId, productId: product.id },
    });

    let isChanged = false;

    if (count === 0) {
      if (existingItem) {
        await this.cartItemRepository.delete({ cartId, productId: product.id });
        isChanged = true;
      }
    } else if (!existingItem) {
      await this.cartItemRepository.save(
        this.cartItemRepository.create({
          cartId,
          productId: product.id,
          title: product.title,
          description: product.description,
          price: product.price,
          count,
        }),
      );
      isChanged = true;
    } else {
      const isSame =
        existingItem.title === product.title &&
        existingItem.description === product.description &&
        existingItem.price === product.price &&
        existingItem.count === count;

      if (!isSame) {
        await this.cartItemRepository.update(
          { cartId, productId: product.id },
          {
            title: product.title,
            description: product.description,
            price: product.price,
            count,
          },
        );
        isChanged = true;
      }
    }

    if (isChanged) {
      await this.touchCart(userCart);
      return this.findOrCreateByUserId(userId);
    }

    return userCart;
  }

  async removeByUserId(userId: string): Promise<void> {
    const cart = await this.cartRepository.findOne({
      where: { userId },
    });

    if (!cart) {
      return;
    }

    await this.cartRepository.delete({ id: cart.id });
  }
}
