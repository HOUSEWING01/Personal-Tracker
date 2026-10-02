-- 0014_deposit_types.sql  (D-029, option 2 for D-015)
-- Two new ledger types for refundable property deposits (advances). Run this file ON ITS OWN, before 0015:
-- a new enum value cannot be used in the transaction that adds it.
--   deposit_received : cash in, never revenue or profit
--   deposit_returned : cash out, never an expense
alter type public.transaction_type add value if not exists 'deposit_received';
alter type public.transaction_type add value if not exists 'deposit_returned';
