import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { CartStatuses } from '../models';
import { CartItemEntity } from './cart-item.entity';

@Entity({ name: 'carts' })
export class CartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: false })
  userId: string;

  @Column({
    type: 'enum',
    enum: CartStatuses,
    default: CartStatuses.OPEN,
  })
  status: CartStatuses;

  @Column({ name: 'created_at', type: 'bigint', nullable: false })
  createdAt: number;

  @Column({ name: 'updated_at', type: 'bigint', nullable: false })
  updatedAt: number;

  @OneToMany(() => CartItemEntity, (item) => item.cart)
  items: CartItemEntity[];
}
