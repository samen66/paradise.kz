<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Admin;

use App\Actions\ApproveClient;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Throwable;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = QueryBuilder::for(User::class)
            ->role('b2b_customer')
            ->allowedFilters(
                AllowedFilter::exact('is_approved'),
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($q) use ($value): void {
                        $q->where('company_name', 'LIKE', "%{$value}%")
                          ->orWhere('company_bin', 'LIKE', "%{$value}%")
                          ->orWhere('email', 'LIKE', "%{$value}%")
                          ->orWhere('phone', 'LIKE', "%{$value}%");
                    });
                }),
            )
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    public function approve(User $user, ApproveClient $approveClient): JsonResponse
    {
        if ($user->is_approved) {
            return response()->json(['message' => 'Клиент уже одобрен'], 400);
        }

        try {
            $user = $approveClient->handle($user);
            return response()->json(['data' => $user]);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Ошибка: ' . $e->getMessage()], 422);
        }
    }
}
