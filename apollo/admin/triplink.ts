import { gql, TypedDocumentNode } from '@apollo/client';
import {
	Member,
	MemberAdminUpdate,
	Tour,
	TourStatus,
	Booking,
	BookingStatus,
	PaymentStatus,
	Review,
	Article,
	Comment,
	Inquiry,
	PageResult,
	Role,
	MemberStatus,
} from '../../libs/types/triplink';
export type Result<T> = { result: T };
export const ADMIN_MEMBERS: TypedDocumentNode<
	Result<PageResult<Member>>,
	{ input: Inquiry<{ memberType?: Role; memberStatus?: MemberStatus; text?: string }> }
> = gql`
	query ADMIN_MEMBERS($input: MembersInquiry!) {
		result: getAllMembersByAdmin(input: $input) {
			list {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_TOURS: TypedDocumentNode<
	Result<PageResult<Tour>>,
	{ input: Inquiry<{ tourStatus?: TourStatus; text?: string; agentId?: string }> }
> = gql`
	query ADMIN_TOURS($input: AllToursInquiry!) {
		result: getAllToursByAdmin(input: $input) {
			list {
				_id
				tourTitle
				tourSlug
				tourDescription
				tourDestination
				tourCountry
				tourCity
				tourImages
				tourPrice
				tourDiscountPrice
				tourDurationDays
				tourAvailableDates {
					_id
					startDate
					endDate
					availableSeats
				}
				tourAvailableSeats
				tourMaxGroupSize
				tourCategory
				tourDifficulty
				tourLanguages
				tourTransportation
				tourAccommodation
				tourMeals
				tourItinerary {
					day
					title
					description
				}
				tourIncludedServices
				tourExcludedServices
				tourAverageRating
				tourReviewCount
				tourBookingCount
				tourViewCount
				tourFavoriteCount
				tourStatus
				tourFeatured
				agentId
				deletedAt
				createdAt
				updatedAt
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_BOOKINGS: TypedDocumentNode<
	Result<PageResult<Booking>>,
	{ input: Inquiry<{ bookingStatus?: BookingStatus; paymentStatus?: PaymentStatus }> }
> = gql`
	query ADMIN_BOOKINGS($input: AllBookingsInquiry!) {
		result: getAllBookingsByAdmin(input: $input) {
			list {
				_id
				bookingCode
				userId
				tourId
				agentId
				tourDateId
				selectedDate
				selectedEndDate
				numberOfPeople
				unitPrice
				totalPrice
				bookingStatus
				paymentStatus
				paymentReference
				paidAt
				refundReference
				refundReason
				refundedAt
				cancellationReason
				cancelledAt
				rejectionReason
				rejectedAt
				completedAt
				createdAt
				updatedAt
				tourData {
					_id
					tourTitle
					tourSlug
					tourDescription
					tourDestination
					tourCountry
					tourCity
					tourImages
					tourPrice
					tourDiscountPrice
					tourDurationDays
					tourAvailableDates {
						_id
						startDate
						endDate
						availableSeats
					}
					tourAvailableSeats
					tourMaxGroupSize
					tourCategory
					tourDifficulty
					tourLanguages
					tourTransportation
					tourAccommodation
					tourMeals
					tourItinerary {
						day
						title
						description
					}
					tourIncludedServices
					tourExcludedServices
					tourAverageRating
					tourReviewCount
					tourBookingCount
					tourViewCount
					tourFavoriteCount
					tourStatus
					tourFeatured
					agentId
					deletedAt
					createdAt
					updatedAt
					agentData {
						_id
						memberType
						memberStatus
						memberNick
						memberFullname
						memberImage
						memberCountry
						memberDesc
						memberFavoriteDestinations
						memberTours
						memberReviews
						memberFollowers
						memberFollowings
						memberLikes
						memberViews
						memberComments
						createdAt
						updatedAt
						isFollowing
					}
				}
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
				userData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_REVIEWS: TypedDocumentNode<
	Result<PageResult<Review>>,
	{ input: Inquiry<{ reviewStatus?: Review['reviewStatus'] }> }
> = gql`
	query ADMIN_REVIEWS($input: AllReviewsInquiry!) {
		result: getAllReviewsByAdmin(input: $input) {
			list {
				_id
				bookingId
				userId
				tourId
				agentId
				reviewRating
				reviewComment
				reviewStatus
				moderationReason
				moderatedAt
				deletedAt
				createdAt
				updatedAt
				userData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
				tourData {
					_id
					tourTitle
					tourSlug
					tourDescription
					tourDestination
					tourCountry
					tourCity
					tourImages
					tourPrice
					tourDiscountPrice
					tourDurationDays
					tourAvailableDates {
						_id
						startDate
						endDate
						availableSeats
					}
					tourAvailableSeats
					tourMaxGroupSize
					tourCategory
					tourDifficulty
					tourLanguages
					tourTransportation
					tourAccommodation
					tourMeals
					tourItinerary {
						day
						title
						description
					}
					tourIncludedServices
					tourExcludedServices
					tourAverageRating
					tourReviewCount
					tourBookingCount
					tourViewCount
					tourFavoriteCount
					tourStatus
					tourFeatured
					agentId
					deletedAt
					createdAt
					updatedAt
					agentData {
						_id
						memberType
						memberStatus
						memberNick
						memberFullname
						memberImage
						memberCountry
						memberDesc
						memberFavoriteDestinations
						memberTours
						memberReviews
						memberFollowers
						memberFollowings
						memberLikes
						memberViews
						memberComments
						createdAt
						updatedAt
						isFollowing
					}
				}
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_ARTICLES: TypedDocumentNode<
	Result<PageResult<Article>>,
	{ input: Inquiry<{ articleStatus?: Article['articleStatus'] }> }
> = gql`
	query ADMIN_ARTICLES($input: AllBoardArticlesInquiry!) {
		result: getAllBoardArticlesByAdmin(input: $input) {
			list {
				_id
				articleCategory
				articleStatus
				articleTitle
				articleContent
				articleImage
				articleLikes
				articleViews
				articleComments
				memberId
				createdAt
				updatedAt
				meLiked
				memberData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_COMMENTS: TypedDocumentNode<
	Result<PageResult<Comment>>,
	{ input: Inquiry<{ commentRefId: string; commentStatus?: Comment['commentStatus'] }> }
> = gql`
	query ADMIN_COMMENTS($input: AllCommentsInquiry!) {
		result: getAllCommentsByAdmin(input: $input) {
			list {
				_id
				commentStatus
				commentGroup
				commentContent
				commentRefId
				memberId
				createdAt
				updatedAt
				memberData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			metaCounter {
				total
			}
		}
	}
`;
export const ADMIN_MEMBER_UPDATE: TypedDocumentNode<Result<Member>, { input: MemberAdminUpdate }> = gql`
	mutation ADMIN_MEMBER_UPDATE($input: MemberAdminUpdate!) {
		result: updateMemberByAdmin(input: $input) {
			_id
			memberType
			memberStatus
			memberNick
			memberFullname
			memberImage
			memberCountry
			memberDesc
			memberFavoriteDestinations
			memberTours
			memberReviews
			memberFollowers
			memberFollowings
			memberLikes
			memberViews
			memberComments
			createdAt
			updatedAt
			isFollowing
		}
	}
`;
export const ADMIN_TOUR_UPDATE: TypedDocumentNode<
	Result<Tour>,
	{ input: { tourId: string; tourStatus?: TourStatus; tourFeatured?: boolean } }
> = gql`
	mutation ADMIN_TOUR_UPDATE($input: TourAdminUpdate!) {
		result: updateTourByAdmin(input: $input) {
			_id
			tourTitle
			tourSlug
			tourDescription
			tourDestination
			tourCountry
			tourCity
			tourImages
			tourPrice
			tourDiscountPrice
			tourDurationDays
			tourAvailableDates {
				_id
				startDate
				endDate
				availableSeats
			}
			tourAvailableSeats
			tourMaxGroupSize
			tourCategory
			tourDifficulty
			tourLanguages
			tourTransportation
			tourAccommodation
			tourMeals
			tourItinerary {
				day
				title
				description
			}
			tourIncludedServices
			tourExcludedServices
			tourAverageRating
			tourReviewCount
			tourBookingCount
			tourViewCount
			tourFavoriteCount
			tourStatus
			tourFeatured
			agentId
			deletedAt
			createdAt
			updatedAt
			agentData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_REFUND: TypedDocumentNode<
	Result<Booking>,
	{ input: { bookingId: string; refundReason: string } }
> = gql`
	mutation ADMIN_REFUND($input: BookingRefundInput!) {
		result: refundBookingByAdmin(input: $input) {
			_id
			bookingCode
			userId
			tourId
			agentId
			tourDateId
			selectedDate
			selectedEndDate
			numberOfPeople
			unitPrice
			totalPrice
			bookingStatus
			paymentStatus
			paymentReference
			paidAt
			refundReference
			refundReason
			refundedAt
			cancellationReason
			cancelledAt
			rejectionReason
			rejectedAt
			completedAt
			createdAt
			updatedAt
			tourData {
				_id
				tourTitle
				tourSlug
				tourDescription
				tourDestination
				tourCountry
				tourCity
				tourImages
				tourPrice
				tourDiscountPrice
				tourDurationDays
				tourAvailableDates {
					_id
					startDate
					endDate
					availableSeats
				}
				tourAvailableSeats
				tourMaxGroupSize
				tourCategory
				tourDifficulty
				tourLanguages
				tourTransportation
				tourAccommodation
				tourMeals
				tourItinerary {
					day
					title
					description
				}
				tourIncludedServices
				tourExcludedServices
				tourAverageRating
				tourReviewCount
				tourBookingCount
				tourViewCount
				tourFavoriteCount
				tourStatus
				tourFeatured
				agentId
				deletedAt
				createdAt
				updatedAt
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			agentData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
			userData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_REVIEW_UPDATE: TypedDocumentNode<
	Result<Review>,
	{ input: { reviewId: string; reviewStatus: Review['reviewStatus']; moderationReason: string } }
> = gql`
	mutation ADMIN_REVIEW_UPDATE($input: ReviewModerationInput!) {
		result: moderateReviewByAdmin(input: $input) {
			_id
			bookingId
			userId
			tourId
			agentId
			reviewRating
			reviewComment
			reviewStatus
			moderationReason
			moderatedAt
			deletedAt
			createdAt
			updatedAt
			userData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
			agentData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
			tourData {
				_id
				tourTitle
				tourSlug
				tourDescription
				tourDestination
				tourCountry
				tourCity
				tourImages
				tourPrice
				tourDiscountPrice
				tourDurationDays
				tourAvailableDates {
					_id
					startDate
					endDate
					availableSeats
				}
				tourAvailableSeats
				tourMaxGroupSize
				tourCategory
				tourDifficulty
				tourLanguages
				tourTransportation
				tourAccommodation
				tourMeals
				tourItinerary {
					day
					title
					description
				}
				tourIncludedServices
				tourExcludedServices
				tourAverageRating
				tourReviewCount
				tourBookingCount
				tourViewCount
				tourFavoriteCount
				tourStatus
				tourFeatured
				agentId
				deletedAt
				createdAt
				updatedAt
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
		}
	}
`;
export const ADMIN_ARTICLE_UPDATE: TypedDocumentNode<
	Result<Article>,
	{ input: { _id: string; articleStatus: 'DELETE' } }
> = gql`
	mutation ADMIN_ARTICLE_UPDATE($input: BoardArticleUpdate!) {
		result: updateBoardArticleByAdmin(input: $input) {
			_id
			articleCategory
			articleStatus
			articleTitle
			articleContent
			articleImage
			articleLikes
			articleViews
			articleComments
			memberId
			createdAt
			updatedAt
			meLiked
			memberData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_COMMENT_UPDATE: TypedDocumentNode<
	Result<Comment>,
	{ input: { _id: string; commentStatus: 'DELETE' } }
> = gql`
	mutation ADMIN_COMMENT_UPDATE($input: CommentUpdate!) {
		result: updateCommentByAdmin(input: $input) {
			_id
			commentStatus
			commentGroup
			commentContent
			commentRefId
			memberId
			createdAt
			updatedAt
			memberData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_EXPIRE: TypedDocumentNode<Result<Booking>, { bookingId: string }> = gql`
	mutation ADMIN_EXPIRE($bookingId: String!) {
		result: expireBookingByAdmin(bookingId: $bookingId) {
			_id
			bookingCode
			userId
			tourId
			agentId
			tourDateId
			selectedDate
			selectedEndDate
			numberOfPeople
			unitPrice
			totalPrice
			bookingStatus
			paymentStatus
			paymentReference
			paidAt
			refundReference
			refundReason
			refundedAt
			cancellationReason
			cancelledAt
			rejectionReason
			rejectedAt
			completedAt
			createdAt
			updatedAt
			tourData {
				_id
				tourTitle
				tourSlug
				tourDescription
				tourDestination
				tourCountry
				tourCity
				tourImages
				tourPrice
				tourDiscountPrice
				tourDurationDays
				tourAvailableDates {
					_id
					startDate
					endDate
					availableSeats
				}
				tourAvailableSeats
				tourMaxGroupSize
				tourCategory
				tourDifficulty
				tourLanguages
				tourTransportation
				tourAccommodation
				tourMeals
				tourItinerary {
					day
					title
					description
				}
				tourIncludedServices
				tourExcludedServices
				tourAverageRating
				tourReviewCount
				tourBookingCount
				tourViewCount
				tourFavoriteCount
				tourStatus
				tourFeatured
				agentId
				deletedAt
				createdAt
				updatedAt
				agentData {
					_id
					memberType
					memberStatus
					memberNick
					memberFullname
					memberImage
					memberCountry
					memberDesc
					memberFavoriteDestinations
					memberTours
					memberReviews
					memberFollowers
					memberFollowings
					memberLikes
					memberViews
					memberComments
					createdAt
					updatedAt
					isFollowing
				}
			}
			agentData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
			userData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_ARTICLE_REMOVE: TypedDocumentNode<Result<Article>, { articleId: string }> = gql`
	mutation ADMIN_ARTICLE_REMOVE($articleId: String!) {
		result: removeBoardArticleByAdmin(articleId: $articleId) {
			_id
			articleCategory
			articleStatus
			articleTitle
			articleContent
			articleImage
			articleLikes
			articleViews
			articleComments
			memberId
			createdAt
			updatedAt
			meLiked
			memberData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;
export const ADMIN_COMMENT_REMOVE: TypedDocumentNode<Result<Comment>, { commentId: string }> = gql`
	mutation ADMIN_COMMENT_REMOVE($commentId: String!) {
		result: removeCommentByAdmin(commentId: $commentId) {
			_id
			commentStatus
			commentGroup
			commentContent
			commentRefId
			memberId
			createdAt
			updatedAt
			memberData {
				_id
				memberType
				memberStatus
				memberNick
				memberFullname
				memberImage
				memberCountry
				memberDesc
				memberFavoriteDestinations
				memberTours
				memberReviews
				memberFollowers
				memberFollowings
				memberLikes
				memberViews
				memberComments
				createdAt
				updatedAt
				isFollowing
			}
		}
	}
`;

import type {
	HelpEntry,
	HelpEntryInput,
	HelpEntryUpdate,
	HelpInquiry,
	AdminHelpSearch,
} from '../../libs/types/triplink';
export const ADMIN_HELP_ENTRIES: TypedDocumentNode<
	Result<PageResult<HelpEntry>>,
	{ input: HelpInquiry<AdminHelpSearch> }
> = gql`
	query ADMIN_HELP_ENTRIES($input: AdminHelpEntriesInquiry!) {
		result: getAllHelpEntriesByAdmin(input: $input) {
			list {
				_id
				noticeCategory
				noticeStatus
				faqTopic
				noticeTitle
				noticeContent
				memberId
				createdAt
				updatedAt
			}
			metaCounter {
				total
			}
		}
	}
`;
export const CREATE_HELP_ENTRY: TypedDocumentNode<Result<HelpEntry>, { input: HelpEntryInput }> = gql`
	mutation CREATE_HELP_ENTRY($input: HelpEntryInput!) {
		result: createHelpEntry(input: $input) {
			_id
			noticeCategory
			noticeStatus
			faqTopic
			noticeTitle
			noticeContent
			memberId
			createdAt
			updatedAt
		}
	}
`;
export const UPDATE_HELP_ENTRY: TypedDocumentNode<Result<HelpEntry>, { input: HelpEntryUpdate }> = gql`
	mutation UPDATE_HELP_ENTRY($input: HelpEntryUpdate!) {
		result: updateHelpEntry(input: $input) {
			_id
			noticeCategory
			noticeStatus
			faqTopic
			noticeTitle
			noticeContent
			memberId
			createdAt
			updatedAt
		}
	}
`;
export const REMOVE_HELP_ENTRY: TypedDocumentNode<Result<boolean>, { entryId: string }> = gql`
	mutation REMOVE_HELP_ENTRY($entryId: String!) {
		result: removeHelpEntry(entryId: $entryId)
	}
`;
