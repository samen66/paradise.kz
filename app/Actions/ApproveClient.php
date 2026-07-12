<?php

declare(strict_types=1);

namespace App\Actions;

use App\Contracts\Erp\OrderTarget;
use App\Models\User;

/**
 * Approve a B2B client and guarantee they are linked to an ERP counterparty
 * (the order `agent`).
 *
 * Per the B2B plan: approval is BLOCKED if a counterparty cannot be created.
 * If the client already carries an `external_counterparty_id` (e.g. an admin
 * pasted an existing one) we skip the API call and just flip the gate.
 *
 * Any error thrown by the provider bubbles up to the caller (the Filament
 * action) so it can show a danger notification and leave the client unapproved.
 */
class ApproveClient
{
    public function __construct(
        private readonly OrderTarget $orders,
    ) {}

    public function handle(User $user): User
    {
        if (blank($user->external_counterparty_id)) {
            $user->external_counterparty_id = $this->orders->createCounterparty($user) ?: null;
        }

        $user->is_approved = true;
        $user->save();

        return $user;
    }
}
