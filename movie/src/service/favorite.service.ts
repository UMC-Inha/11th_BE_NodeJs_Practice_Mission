import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateFavoriteDto } from '../dto/create-favorite.dto.js';
import { FavoriteResponseDto } from '../dto/favorite-response.dto.js';
import { FavoriteStatusResponseDto } from '../dto/favorite-status-response.dto.js';
import { Favorite } from '../entity/favorite.entity.js';
import { Member } from '../entity/member.entity.js';
import {
  favoriteDuplicated,
  favoriteNotFound,
  memberNotFound,
} from '../exception/api.exception.js';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  /** 즐겨찾기를 등록한다. memberId 는 토큰에서 나온 값이고, 요청 Body 의 값이 아니다. */
  async create(
    memberId: number,
    dto: CreateFavoriteDto,
  ): Promise<FavoriteResponseDto> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw memberNotFound();
    }

    // 사전 검사는 "이미 즐겨찾기하셨습니다" 라는 분명한 메시지(FAVORITE409_1)를 주려는 것이다.
    // 이 검사와 저장 사이에 같은 요청이 끼어드는 동시 요청까지는 막지 못하므로,
    // (member_id, movie_id) 복합 UNIQUE 가 데이터 자체를 지키는 마지막 안전망으로 남아 있다.
    const existing = await this.favoriteRepository.exists({
      where: { member: { memberId }, movieId: dto.movieId },
    });
    if (existing) {
      throw favoriteDuplicated();
    }

    const saved = await this.favoriteRepository.save(
      this.favoriteRepository.create({ member, movieId: dto.movieId }),
    );
    return FavoriteResponseDto.from(saved);
  }

  /** 내 즐겨찾기만, 최근에 등록한 순서로. 보관한 영화가 없으면 오류가 아니라 빈 배열이다. */
  async getMyFavorites(memberId: number): Promise<FavoriteResponseDto[]> {
    const favorites = await this.favoriteRepository.find({
      where: { member: { memberId } },
      // 같은 초에 등록한 것도 순서가 흔들리지 않게 PK 기준 최신순
      order: { favoriteId: 'DESC' },
    });
    return favorites.map((favorite) => FavoriteResponseDto.from(favorite));
  }

  /** 이 영화를 즐겨찾기했는지. 하지 않았어도 정상 상태라 isFavorite: false 로 답한다. */
  async getStatus(
    memberId: number,
    movieId: number,
  ): Promise<FavoriteStatusResponseDto> {
    const isFavorite = await this.favoriteRepository.exists({
      where: { member: { memberId }, movieId },
    });
    return FavoriteStatusResponseDto.from(isFavorite);
  }

  async delete(memberId: number, movieId: number): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { member: { memberId }, movieId },
    });
    if (!favorite) {
      throw favoriteNotFound();
    }

    await this.favoriteRepository.remove(favorite);
  }
}
