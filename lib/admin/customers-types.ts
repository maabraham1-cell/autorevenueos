export type AdminCustomerListRow = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  phone: string | null;
  /** dedicated (default) = purchased number; pool = assigned from twilio_number_pool */
  phone_number_mode?: string | null;
  contact_count: number;
  conversation_count: number;
  recovery_count: number;
  confirmed_booking_count: number;
};

export type AdminCustomerDetail = {
  id: string;
  name: string;
  email: string | null;
  created_at: string;
  business_mobile: string | null;
  twilio_phone_number: string | null;
  industry: string | null;
  activation_status: string | null;
  booking_link: string | null;
  phone_number_mode?: string | null;
  twilio_pool_entry_id?: string | null;
  contact_count: number;
  conversation_count: number;
  recovery_count: number;
  confirmed_booking_count: number;
};
