import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import TicketPaymentService from '../thirdparty/paymentgateway/TicketPaymentService.js';
import SeatReservationService from '../thirdparty/seatbooking/SeatReservationService.js';

const TICKET_PRICES = { 
    ADULT: 25, 
    CHILD: 15,
    INFANT: 0 
};

const MAX_TICKETS = 25;

  /**
   * Should only have private methods other than the one below.
   */
export default class TicketService {
  #paymentService = new TicketPaymentService();
  #seatReservationService = new SeatReservationService();

  purchaseTickets(accountId, ...ticketTypeRequests) {
    // throws InvalidPurchaseException

    //  take acccount id and array of ticket type requests (TicketTypeRequest)
    this.#validateAccountId(accountId);
    this.#validateRequests(ticketTypeRequests);

    const counts = this.#countTickets(ticketTypeRequests);
    this.#validateBusinessRules(counts);

    const totalAmount = this.#calculateTotalAmount(counts);
    const totalSeats = counts.ADULT + counts.CHILD;

    this.#paymentService.makePayment(accountId, totalAmount);
    this.#seatReservationService.reserveSeat(accountId, totalSeats);
  }

  #validateAccountId(accountId) {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      throw new InvalidPurchaseException('Invalid account ID');
    }
  }

  #validateRequests(ticketTypeRequests) {
    if (!ticketTypeRequests.length) {
      throw new InvalidPurchaseException('No ticket requests provided');
    }
    for (const request of ticketTypeRequests) {
      if (!(request instanceof TicketTypeRequest)) {
        throw new InvalidPurchaseException('Invalid ticket request');
      }
      if (request.getNoOfTickets() <= 0) {
        throw new InvalidPurchaseException('Ticket count must be a positive integer');
      }
    }
  }

  #countTickets(ticketTypeRequests) {
    const counts = { ADULT: 0, CHILD: 0, INFANT: 0 };
    for (const request of ticketTypeRequests) {
      counts[request.getTicketType()] += request.getNoOfTickets();
    }
    return counts;
  }

  #validateBusinessRules(counts) {
    const total = counts.ADULT + counts.CHILD + counts.INFANT;
    if (total > MAX_TICKETS) {
      throw new InvalidPurchaseException(`Cannot purchase more than ${MAX_TICKETS} tickets at a time`);
    }
    if (counts.ADULT === 0 && (counts.CHILD > 0 || counts.INFANT > 0)) {
      throw new InvalidPurchaseException('Child and Infant tickets require at least one Adult ticket');
    }
    if (counts.INFANT > counts.ADULT) {
        throw new InvalidPurchaseException('Cannot have more Infant tickets than Adult tickets');
    }
  }

  #calculateTotalAmount(counts) {
    let total = 0;
    for (const type in counts) {
      total += TICKET_PRICES[type] * counts[type];
    }
    return total;
  }
}
