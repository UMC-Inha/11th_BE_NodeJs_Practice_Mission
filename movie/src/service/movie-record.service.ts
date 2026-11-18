import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CreateMovieRecordDto } from '../dto/create-movie-record.dto.js';
import { FavoriteResponseDto } from '../dto/favorite-response.dto.js';
import { MovieRecordResponseDto } from '../dto/movie-record-response.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { Favorite } from '../entity/favorite.entity.js';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import { ApiException } from '../exception/api.exception.js';

@Injectable()
export class MovieRecordService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    memberId: number,
    dto: CreateMovieRecordDto,
  ): Promise<MovieRecordResponseDto> {
    return this.dataSource.transaction(async (manager) => {
      const members = manager.getRepository(Member);
      const ratings = manager.getRepository(Rating);
      const favorites = manager.getRepository(Favorite);
      const member = await members.findOneBy({ memberId });
      if (!member) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          'MEMBER404_1',
          '해당 회원을 찾을 수 없습니다.',
        );
      }

      const where = { member: { memberId }, movieId: dto.movieId };
      if (await ratings.exists({ where })) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'RATING409_1',
          '이미 이 영화에 평점을 남기셨습니다.',
        );
      }

      if (dto.addToFavorites && (await favorites.exists({ where }))) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'FAVORITE409_1',
          '이미 이 영화를 즐겨찾기하셨습니다.',
        );
      }

      const rating = await ratings.save(
        ratings.create({
          member,
          movieId: dto.movieId,
          score: dto.score,
          comment: dto.comment ?? null,
        }),
      );

      let favorite: FavoriteResponseDto | null = null;
      if (dto.addToFavorites) {
        const saved = await favorites.save(
          favorites.create({ member, movieId: dto.movieId }),
        );
        favorite = FavoriteResponseDto.from(saved);
      }

      return MovieRecordResponseDto.of(RatingResponseDto.from(rating), favorite);
    });
  }
}
