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
      expect(() =>
        service.purchaseTickets(0, new TicketTypeRequest('ADULT', 1))
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects negative account ID', () => {
      expect(() =>
        service.purchaseTickets(-1, new TicketTypeRequest('ADULT', 1))
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects non-integer account ID', () => {
      expect(() =>
        service.purchaseTickets(1.5, new TicketTypeRequest('ADULT', 1))
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects string account ID', () => {
      expect(() =>
        service.purchaseTickets('1', new TicketTypeRequest('ADULT', 1))
      ).toThrow(InvalidPurchaseException);
    });
  });

  describe('invalid ticket requests', () => {
    it('rejects call with no ticket requests', () => {
      expect(() => service.purchaseTickets(1)).toThrow(InvalidPurchaseException);
    });

    it('rejects non-TicketTypeRequest arguments', () => {
      expect(() =>
        service.purchaseTickets(1, { type: 'ADULT', count: 1 })
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects a request with zero ticket count', () => {
      expect(() =>
        service.purchaseTickets(1, new TicketTypeRequest('ADULT', 0))
      ).toThrow(InvalidPurchaseException);
    });
  });

  describe('business rule violations', () => {
    it('rejects child-only purchase (no adult)', () => {
      expect(() =>
        service.purchaseTickets(1, new TicketTypeRequest('CHILD', 1))
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects infant-only purchase (no adult)', () => {
      expect(() =>
        service.purchaseTickets(1, new TicketTypeRequest('INFANT', 1))
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects child + infant with no adult', () => {
      expect(() =>
        service.purchaseTickets(
          1,
          new TicketTypeRequest('CHILD', 1),
          new TicketTypeRequest('INFANT', 1)
        )
      ).toThrow(InvalidPurchaseException);
    });

    it('rejects 26 tickets (exceeds maximum)', () => {
      expect(() =>
        service.purchaseTickets(
          1,
          new TicketTypeRequest('ADULT', 20),
          new TicketTypeRequest('CHILD', 6)
        )
      ).toThrow(InvalidPurchaseException);
    });
  });
});
