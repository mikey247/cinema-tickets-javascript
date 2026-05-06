import { jest } from '@jest/globals';

import TicketService from '../src/pairtest/TicketService.js';
import TicketTypeRequest from '../src/pairtest/lib/TicketTypeRequest.js';
import InvalidPurchaseException from '../src/pairtest/lib/InvalidPurchaseException.js';
import TicketPaymentService from '../src/thirdparty/paymentgateway/TicketPaymentService.js';
import SeatReservationService from '../src/thirdparty/seatbooking/SeatReservationService.js';

describe('TicketService', () => {
  let service;
  let makePayment;
  let reserveSeat;

  beforeEach(() => {
    makePayment = jest.spyOn(TicketPaymentService.prototype, 'makePayment');
    reserveSeat = jest.spyOn(SeatReservationService.prototype, 'reserveSeat');
    service = new TicketService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectRejectedPurchase = (...args) => {
    expect(() => service.purchaseTickets(...args)).toThrow(InvalidPurchaseException);
    expect(makePayment).not.toHaveBeenCalled();
    expect(reserveSeat).not.toHaveBeenCalled();
  };

  describe('valid purchases', () => {
    it('single adult ticket charges £25 and reserves 1 seat', () => {
      service.purchaseTickets(1, new TicketTypeRequest('ADULT', 1));
      expect(makePayment).toHaveBeenCalledWith(1, 25);
      expect(reserveSeat).toHaveBeenCalledWith(1, 1);
    });

    it('multiple adults charges correctly and reserves all seats', () => {
      service.purchaseTickets(1, new TicketTypeRequest('ADULT', 3));
      expect(makePayment).toHaveBeenCalledWith(1, 75);
      expect(reserveSeat).toHaveBeenCalledWith(1, 3);
    });

    it('adult and child tickets calculate correct total and seat count', () => {
      service.purchaseTickets(
        1,
        new TicketTypeRequest('ADULT', 2),
        new TicketTypeRequest('CHILD', 3)
      );
      expect(makePayment).toHaveBeenCalledWith(1, 95); // 2×25 + 3×15
      expect(reserveSeat).toHaveBeenCalledWith(1, 5);
    });

    it('infant tickets add £0 and no seat', () => {
      service.purchaseTickets(
        1,
        new TicketTypeRequest('ADULT', 1),
        new TicketTypeRequest('INFANT', 1)
      );
      expect(makePayment).toHaveBeenCalledWith(1, 25);
      expect(reserveSeat).toHaveBeenCalledWith(1, 1);
    });

    it('mixed adult, child, and infant tickets are handled correctly', () => {
      service.purchaseTickets(
        42,
        new TicketTypeRequest('ADULT', 2),
        new TicketTypeRequest('CHILD', 2),
        new TicketTypeRequest('INFANT', 2)
      );
      expect(makePayment).toHaveBeenCalledWith(42, 80); // 2×25 + 2×15
      expect(reserveSeat).toHaveBeenCalledWith(42, 4);  // adults + children only
    });

    it('exactly 25 tickets is accepted (boundary)', () => {
      service.purchaseTickets(
        1,
        new TicketTypeRequest('ADULT', 15),
        new TicketTypeRequest('CHILD', 10)
      );
      expect(makePayment).toHaveBeenCalledWith(1, 525); // 15×25 + 10×15
      expect(reserveSeat).toHaveBeenCalledWith(1, 25);
    });

    it('uses the provided account ID when calling both services', () => {
      service.purchaseTickets(99, new TicketTypeRequest('ADULT', 1));
      expect(makePayment).toHaveBeenCalledWith(99, 25);
      expect(reserveSeat).toHaveBeenCalledWith(99, 1);
    });
  });

  describe('invalid account IDs', () => {
    it('rejects account ID of 0', () => {
      expectRejectedPurchase(0, new TicketTypeRequest('ADULT', 1));
    });

    it('rejects negative account ID', () => {
      expectRejectedPurchase(-1, new TicketTypeRequest('ADULT', 1));
    });

    it('rejects non-integer account ID', () => {
      expectRejectedPurchase(1.5, new TicketTypeRequest('ADULT', 1));
    });

    it('rejects string account ID', () => {
      expectRejectedPurchase('1', new TicketTypeRequest('ADULT', 1));
    });
  });

  describe('invalid ticket requests', () => {
    it('rejects call with no ticket requests', () => {
      expectRejectedPurchase(1);
    });

    it('rejects non-TicketTypeRequest arguments', () => {
      expectRejectedPurchase(1, { type: 'ADULT', count: 1 });
    });

    it('rejects a request with zero ticket count', () => {
      expectRejectedPurchase(1, new TicketTypeRequest('ADULT', 0));
    });

    it('handles duplicate ticket types by summing them', () => {
        // Two ADULT requests should combine: total 2 adults, £50, 2 seats
        service.purchaseTickets(1, new TicketTypeRequest('ADULT', 1), new TicketTypeRequest('ADULT', 1));
        expect(makePayment).toHaveBeenCalledWith(1, 50);
        expect(reserveSeat).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('business rule violations', () => {

    it('rejects more infants than adults (1 adult, 2 infants)', () => {
    expectRejectedPurchase(1, new TicketTypeRequest('ADULT', 1), new TicketTypeRequest('INFANT', 2));
    });

    it('rejects more infants than adults at scale (2 adults, 3 infants)', () => {
    expectRejectedPurchase( 1, new TicketTypeRequest('ADULT', 2), new TicketTypeRequest('INFANT', 3));
    });

    it('accepts equal infants to adults (2 adults, 2 infants)', () => {
    service.purchaseTickets(1, new TicketTypeRequest('ADULT', 2),new TicketTypeRequest('INFANT', 2) );
    expect(makePayment).toHaveBeenCalledWith(1, 50);  // 2×25, infants free
    expect(reserveSeat).toHaveBeenCalledWith(1, 2);   // infants take no seat
    });
    
    it('accepts 25 tickets when infants do count toward the cap', () => {
        // Confirms 25 is still valid with a mixed adult/infant split
        service.purchaseTickets( 1, new TicketTypeRequest('ADULT', 20), new TicketTypeRequest('INFANT', 5));
        expect(makePayment).toHaveBeenCalledWith(1, 500); // 20×25
        expect(reserveSeat).toHaveBeenCalledWith(1, 20);  // infants sit on laps
    });

    it('rejects child-only purchase (no adult)', () => {
      expectRejectedPurchase(1, new TicketTypeRequest('CHILD', 1));
    });

    it('rejects infant-only purchase (no adult)', () => {
      expectRejectedPurchase(1, new TicketTypeRequest('INFANT', 1));
    });

    it('rejects child + infant with no adult', () => {
      expectRejectedPurchase( 1, new TicketTypeRequest('CHILD', 1), new TicketTypeRequest('INFANT', 1));
    });

    it('rejects 26 tickets (exceeds maximum)', () => {
      expectRejectedPurchase(1, new TicketTypeRequest('ADULT', 20), new TicketTypeRequest('CHILD', 6));
    });

  });
});
