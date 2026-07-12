<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * Shape the public user payload. Never leaks password / tokens.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'type' => $this->type,
            'company_name' => $this->company_name,
            'company_bin' => $this->company_bin,
            'is_approved' => (bool) $this->is_approved,
            'discount_percent' => $this->discount_percent,
            'preferred_store_id' => $this->preferred_store_id,
        ];
    }
}
