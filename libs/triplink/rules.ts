import { Booking, Tour, Role } from '../types/triplink';
export function bookingActions(booking: Booking, role: Role, now = Date.now()) {
	const future = new Date(booking.selectedDate).getTime() > now;
	const active = booking.tourData && ['ACTIVE', 'SOLD_OUT'].includes(booking.tourData.tourStatus);
	const unpaid = booking.paymentStatus === 'UNPAID';
	const pending = booking.bookingStatus === 'PENDING';
	const confirmed = booking.bookingStatus === 'CONFIRMED';
	const completed = booking.bookingStatus === 'COMPLETED';
	const paid = booking.paymentStatus === 'PAID';
	const end =
		booking.selectedEndDate ??
		booking.tourData?.tourAvailableDates.find((date) => date._id === booking.tourDateId)?.endDate;
	return {
		cancel: role === 'USER' && unpaid && future && (pending || confirmed),
		pay: role === 'USER' && unpaid && future && confirmed && Boolean(active),
		confirm: role === 'AGENT' && pending && unpaid && future && booking.tourData?.tourStatus === 'ACTIVE',
		reject: role === 'AGENT' && pending && unpaid,
		complete:
			role === 'AGENT' && confirmed && paid && Boolean(active) && Boolean(end) && new Date(end!).getTime() <= now,
		expire: role === 'ADMIN' && unpaid && !future && (pending || confirmed),
		refund:
			role === 'ADMIN' &&
			paid &&
			((confirmed &&
				(future
					? Boolean(active) || booking.tourData?.tourStatus === 'CANCELLED'
					: booking.tourData?.tourStatus === 'CANCELLED')) ||
				(completed && booking.tourData?.tourStatus === 'CANCELLED')),
		review: role === 'USER' && completed && paid,
	};
}
export function bookingCapacity(tour: Tour, dateId: string, now = Date.now()) {
	const date = tour.tourAvailableDates.find((item) => item._id === dateId);
	if (tour.tourStatus !== 'ACTIVE' || !date || new Date(date.startDate).getTime() <= now) return 0;
	return Math.min(100, date.availableSeats, tour.tourAvailableSeats, tour.tourMaxGroupSize);
}
