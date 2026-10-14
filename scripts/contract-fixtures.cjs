// Synthetic values only; this validation never connects to MongoDB or calls a resolver.
const id = '0123456789abcdef01234567';
const tour = {
	tourTitle: 'Disposable tour',
	tourDescription: 'A synthetic contract validation tour description.',
	tourDestination: 'Seoul',
	tourCountry: 'Korea',
	tourCity: 'Seoul',
	tourImages: [],
	tourPrice: 100,
	tourDurationDays: 1,
	tourAvailableDates: [
		{ startDate: '2099-01-01T00:00:00.000Z', endDate: '2099-01-02T00:00:00.000Z', availableSeats: 5 },
	],
	tourAvailableSeats: 5,
	tourMaxGroupSize: 5,
	tourCategory: 'CITY',
	tourDifficulty: 'EASY',
	tourLanguages: ['English'],
	tourTransportation: [],
	tourMeals: [],
	tourItinerary: [{ day: 1, title: 'City walk', description: 'Discover the city on foot.' }],
	tourIncludedServices: [],
	tourExcludedServices: [],
};
module.exports = [
	[
		'tour/tour.input',
		'ToursInquiry',
		{
			page: 1,
			limit: 12,
			search: { agentId: id, priceRange: { start: 0, end: 1000 } },
			sort: 'tourPrice',
			direction: 'ASC',
		},
	],
	['tour/tour.input', 'AgentToursInquiry', { page: 1, limit: 12, search: {} }],
	['tour/tour.input', 'FavoriteToursInquiry', { page: 1, limit: 100 }],
	['tour/tour.input', 'TourInput', tour],
	[
		'member/member.input',
		'MemberInput',
		{
			memberNick: 'synthetic_user',
			memberPassword: 'Synthetic123!',
			memberPhone: '01012345678',
			memberType: 'USER',
			memberAuthType: 'PHONE',
		},
	],
	['booking/booking.input', 'BookingInput', { tourId: id, tourDateId: id, numberOfPeople: 2 }],
	['booking/booking.input', 'MyBookingsInquiry', { page: 1, limit: 12, search: {} }],
	[
		'booking/booking.input',
		'BookingCancellationInput',
		{ bookingId: id, cancellationReason: 'Synthetic cancellation' },
	],
	['booking/booking.input', 'BookingRefundInput', { bookingId: id, refundReason: 'Synthetic refund' }],
	['follow/follow.input', 'FollowInquiry', { page: 1, limit: 12, search: { memberId: id } }],
];

module.exports.push(
	[
		'help-center/help-center.input',
		'HelpEntryInput',
		{
			noticeCategory: 'FAQ',
			faqTopic: 'BOOKINGS',
			noticeTitle: 'Seats reserved',
			noticeContent: 'Seats are reserved on confirmation.',
		},
	],
	[
		'help-center/help-center.input',
		'HelpEntryInput',
		{
			noticeCategory: 'NOTICE',
			noticeTitle: 'Service notice',
			noticeContent: 'A synthetic plain text notice.',
			noticeStatus: 'HOLD',
		},
	],
	[
		'help-center/help-center.input',
		'HelpEntriesInquiry',
		{ page: 1, limit: 12, search: { noticeCategory: 'FAQ', faqTopic: 'BOOKINGS', text: 'seats' } },
	],
	[
		'help-center/help-center.input',
		'AdminHelpEntriesInquiry',
		{ page: 1, limit: 12, search: { noticeCategory: 'NOTICE', noticeStatus: 'HOLD' } },
	],
	['help-center/help-center.update', 'HelpEntryUpdate', { entryId: id, noticeStatus: 'ACTIVE' }],
	['ai/ai-chat.input', 'AiChatInput', { message: 'Sayohat topishga yordam bering.', locale: 'uz', intent: 'FIND_TOURS' }],
);
