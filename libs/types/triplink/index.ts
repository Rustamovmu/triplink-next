export type Role = 'USER' | 'AGENT' | 'ADMIN';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'BLOCK' | 'SUSPENDED' | 'DELETE';
export type TourStatus = 'DRAFT' | 'PENDING' | 'ACTIVE' | 'SOLD_OUT' | 'COMPLETED' | 'CANCELLED';
export type TourCategory = 'ADVENTURE' | 'BEACH' | 'CITY' | 'CULTURAL' | 'FOOD' | 'NATURE' | 'WELLNESS' | 'WILDLIFE';
export type TourDifficulty = 'EASY' | 'MODERATE' | 'CHALLENGING';
export interface PageResult<T> {
	list: T[];
	metaCounter: { total: number }[];
}
export interface Inquiry<S = Record<string, never>> {
	page: number;
	limit: number;
	search: S;
	sort?: string;
	direction?: 'ASC' | 'DESC';
}
export interface Member {
	_id: string;
	memberType: Role;
	memberStatus: MemberStatus;
	memberNick: string;
	memberFullname: string | null;
	memberImage: string;
	memberCountry: string | null;
	memberDesc: string | null;
	memberFavoriteDestinations: string[];
	memberTours: number;
	memberReviews: number;
	memberFollowers: number;
	memberFollowings: number;
	memberLikes: number;
	memberViews: number;
	memberComments: number;
	createdAt: string;
	updatedAt: string;
	isFollowing: boolean | null;
}
export interface PublicMember extends Member {
	agentAverageRating: number | null;
	agentReviewCount: number | null;
	agentTourCount: number | null;
	recentTours: Tour[] | null;
}
export interface AuthPayload {
	accessToken: string;
	member: Member;
}
export interface MemberInput {
	memberNick: string;
	memberPassword: string;
	memberPhone: string;
	memberType: 'USER' | 'AGENT';
	memberAuthType: 'PHONE';
}
export interface MemberUpdate {
	memberNick?: string;
	memberFullname?: string;
	memberImage?: string;
	memberCountry?: string;
	memberDesc?: string;
	memberFavoriteDestinations?: string[];
	passwordChange?: { currentPassword: string; newPassword: string };
}
export interface TourDateInput {
	startDate: string;
	endDate: string;
	availableSeats: number;
}
export interface TourDate extends TourDateInput {
	_id: string;
}
export interface ItineraryItem {
	day: number;
	title: string;
	description: string;
}
export interface TourInput {
	tourTitle: string;
	tourDescription: string;
	tourDestination: string;
	tourCountry: string;
	tourCity: string;
	tourImages: string[];
	tourPrice: number;
	tourDiscountPrice?: number;
	tourDurationDays: number;
	tourAvailableDates: TourDateInput[];
	tourAvailableSeats: number;
	tourMaxGroupSize: number;
	tourCategory: TourCategory;
	tourDifficulty: TourDifficulty;
	tourLanguages: string[];
	tourTransportation: string[];
	tourAccommodation?: string;
	tourMeals: string[];
	tourItinerary: ItineraryItem[];
	tourIncludedServices: string[];
	tourExcludedServices: string[];
}
export interface Tour extends Omit<TourInput, 'tourAvailableDates' | 'tourDiscountPrice' | 'tourAccommodation'> {
	_id: string;
	tourSlug: string;
	tourDiscountPrice: number | null;
	tourAccommodation: string | null;
	tourAvailableDates: TourDate[];
	tourStatus: TourStatus;
	tourFeatured: boolean;
	agentId: string;
	tourAverageRating: number;
	tourReviewCount: number;
	tourBookingCount: number;
	tourViewCount: number;
	tourFavoriteCount: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	agentData: Member | null;
}
export interface TourSearch {
	agentId?: string;
	text?: string;
	destinations?: string[];
	countries?: string[];
	cities?: string[];
	categories?: TourCategory[];
	difficulties?: TourDifficulty[];
	priceRange?: { start: number; end: number };
	durationRange?: { start: number; end: number };
	availableDateRange?: { start: string; end: string };
	minimumAvailableSeats?: number;
	minimumRating?: number;
	featured?: boolean;
}
export interface TourUpdate extends Partial<TourInput> {
	tourId: string;
	tourStatus?: TourStatus;
}
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';
export interface BookingInput {
	tourId: string;
	tourDateId: string;
	numberOfPeople: number;
}
export interface Booking {
	_id: string;
	bookingCode: string;
	userId: string;
	tourId: string;
	agentId: string;
	tourDateId: string;
	selectedDate: string;
	selectedEndDate: string | null;
	numberOfPeople: number;
	unitPrice: number;
	totalPrice: number;
	bookingStatus: BookingStatus;
	paymentStatus: PaymentStatus;
	paymentReference: string | null;
	paidAt: string | null;
	refundReference: string | null;
	refundReason: string | null;
	refundedAt: string | null;
	cancellationReason: string | null;
	cancelledAt: string | null;
	rejectionReason: string | null;
	rejectedAt: string | null;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
	tourData: Tour | null;
	agentData: Member | null;
	userData: Member | null;
}
export interface ReviewInput {
	bookingId: string;
	reviewRating: number;
	reviewComment: string;
}
export interface Review {
	_id: string;
	bookingId: string;
	userId: string;
	tourId: string;
	agentId: string;
	reviewRating: number;
	reviewComment: string;
	reviewStatus: 'ACTIVE' | 'HIDDEN' | 'DELETE';
	moderationReason: string | null;
	moderatedAt: string | null;
	deletedAt: string | null;
	createdAt: string;
	updatedAt: string;
	userData: Member | null;
	agentData: Member | null;
	tourData: Tour | null;
}
export interface FollowMember {
	_id: string;
	followingId: string;
	followerId: string;
	followedAt: string;
	memberData: Member | null;
	isFollowing: boolean;
}
export type ArticleCategory = 'FREE' | 'RECOMMEND' | 'NEWS' | 'HUMOR';
export interface ArticleInput {
	articleCategory: ArticleCategory;
	articleTitle: string;
	articleContent: string;
	articleImage?: string;
}
export interface Article extends Omit<ArticleInput, 'articleImage'> {
	_id: string;
	articleImage: string | null;
	articleStatus: 'ACTIVE' | 'DELETE';
	memberId: string;
	memberData: Member | null;
	articleLikes: number;
	articleViews: number;
	articleComments: number;
	meLiked: boolean;
	createdAt: string;
	updatedAt: string;
}
export interface MemberAdminUpdate extends Omit<MemberUpdate, 'passwordChange'> {
	memberId: string;
	memberType?: Role;
	memberStatus?: MemberStatus;
}
export interface Comment {
	_id: string;
	commentContent: string;
	commentRefId: string;
	commentGroup: 'ARTICLE';
	commentStatus: 'ACTIVE' | 'DELETE';
	memberId: string;
	memberData: Member | null;
	createdAt: string;
	updatedAt: string;
}
export interface ChatMessage {
	_id: string;
	text: string;
	createdAt: string;
	memberData: Pick<Member, '_id' | 'memberNick' | 'memberType'>;
}
export const tourCategories: TourCategory[] = [
	'ADVENTURE',
	'BEACH',
	'CITY',
	'CULTURAL',
	'FOOD',
	'NATURE',
	'WELLNESS',
	'WILDLIFE',
];
export const tourDifficulties: TourDifficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];
export const tourSorts = [
	'createdAt',
	'updatedAt',
	'tourPrice',
	'tourDurationDays',
	'tourAverageRating',
	'tourBookingCount',
	'tourViewCount',
	'tourFavoriteCount',
];
export const totalOf = (result?: { metaCounter: { total: number }[] }) => result?.metaCounter[0]?.total ?? 0;

export type HelpKind = 'FAQ' | 'NOTICE';
export type HelpStatus = 'HOLD' | 'ACTIVE';
export type FaqTopic = 'TOURS' | 'BOOKINGS' | 'PAYMENTS' | 'ACCOUNTS' | 'AGENTS' | 'COMMUNITY' | 'OTHER';
export interface HelpEntry {
	_id: string;
	noticeCategory: HelpKind;
	noticeStatus: HelpStatus;
	faqTopic?: FaqTopic | null;
	noticeTitle: string;
	noticeContent: string;
	memberId: string;
	createdAt: string;
	updatedAt: string;
}
export interface HelpEntryInput {
	noticeCategory: HelpKind;
	faqTopic?: FaqTopic;
	noticeTitle: string;
	noticeContent: string;
	noticeStatus?: HelpStatus;
}
export interface HelpEntryUpdate {
	entryId: string;
	faqTopic?: FaqTopic;
	noticeTitle?: string;
	noticeContent?: string;
	noticeStatus?: HelpStatus;
}
export interface HelpSearch {
	noticeCategory?: HelpKind;
	faqTopic?: FaqTopic;
	text?: string;
}
export interface AdminHelpSearch extends HelpSearch {
	noticeStatus?: HelpStatus;
}
export interface HelpInquiry<S = HelpSearch> {
	page: number;
	limit: number;
	search: S;
}
