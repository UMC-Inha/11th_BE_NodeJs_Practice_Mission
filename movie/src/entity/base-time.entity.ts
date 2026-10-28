import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Member·Rating·(8주차) Favorite 이 똑같이 가지는 생성/수정 시각.
 * @Entity() 가 없으므로 그 자체로는 테이블이 되지 않고, 상속한 엔티티에 컬럼만 물려준다.
 */
export abstract class BaseTimeEntity {
  // INSERT 시점에 한 번만 채워지고 이후 바뀌지 않습니다.
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  // 저장될 때마다 TypeORM이 현재 시각으로 다시 채워줍니다.
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;
}
