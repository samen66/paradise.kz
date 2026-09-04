<?php

declare(strict_types=1);

namespace App\Actions;

use App\Contracts\Erp\OrderTarget;
use App\Models\User;

/**
 * Approve a B2B client, linking them to an ERP counterparty (the order `agent`)
 * when an ERP is actually connected.
 *
 * Approval is a local decision — it opens the wholesale catalog and pricing for
 * this client — so with no ERP behind us (the `local` provider) there is simply
 * no counterparty to create and the gate flips on its own.
 *
 * When an ERP IS connected the old rule still holds: approval is BLOCKED if the
 * counterparty cannot be created, because orders would then be unpushable. Any
 * error from the provider bubbles up to the caller (the Filament action) so it
 * can show a danger notification and leave the client unapproved. A client that
 * already carries an `external_counterparty_id` skips the API call.
 */
class ApproveClient
{
    public function __construct(
        private readonly OrderTarget $orders,
    ) {}

    public function handle(User $user): User
    {
        if ($this->orders->supportsCounterparties() && blank($user->external_counterparty_id)) {
            $user->external_counterparty_id = $this->orders->createCounterparty($user) ?: null;
        }

        $user->is_approved = true;
        $user->save();

        return $user;
    }
}
