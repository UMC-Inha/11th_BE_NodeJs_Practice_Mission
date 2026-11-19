## 즐겨찾기

즐겨찾기는 영화의 속성이 아니다. 어떤 회원에게는 좋아하는 영화여도 다른 회원에게는 아니다. 그래서 `Favorite`에 `Member`와 `movieId`가 함께 들어간다.

```ts
@Entity("favorite")
@Unique("uk_favorite_member_movie", ["member", "movieId"])
export class Favorite extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: "favorite_id" })
  favoriteId: number;

  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: "member_id" })
  member: Member;

  @Column({ name: "movie_id" })
  movieId: number;
}
```

`@Unique`에 두 값을 한 쌍으로 묶었다. `movieId`만 UNIQUE로 걸면 한 영화를 서비스 전체에서 한 사람만 즐겨찾기할 수 있게 된다.

## 평점과 즐겨찾기 → 하나의 트랜잭션

평점과 즐겨찾기 중 하나만 저장되면 사용자가 의도한 기록과 달라진다. 두 저장을 하나의 트랜잭션으로 묶어 중간에 실패하면 앞서 저장한 것도 남지 않게 했다.

```ts
return this.dataSource.transaction(async (manager) => {
  const memberRepository = manager.getRepository(Member);
  const ratingRepository = manager.getRepository(Rating);
  const favoriteRepository = manager.getRepository(Favorite);

  // 회원 확인, 평점 중복 확인, 즐겨찾기 중복 확인

  const savedRating = await ratingRepository.save(
    ratingRepository.create({
      member,
      movieId: dto.movieId,
      score: dto.score,
      comment: dto.comment,
    }),
  );

  let favoriteResponse: FavoriteResponseDto | null = null;
  if (dto.addToFavorites) {
    const savedFavorite = await favoriteRepository.save(
      favoriteRepository.create({ member, movieId: dto.movieId }),
    );
    favoriteResponse = FavoriteResponseDto.from(savedFavorite);
  }

  return MovieRecordResponseDto.of(RatingResponseDto.from(savedRating), favoriteResponse);
});
```

콜백 안에서는 `manager.getRepository()`로 꺼낸 Repository만 쓴다. 생성자로 주입받은 Repository를 섞어 쓰면 다른 DB 연결을 타게 되어, 롤백이 일어나도 그쪽 저장은 남는다. 그래서 이 서비스는 Repository를 주입받지 않고 `DataSource` 하나만 받는다.