<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Fix typo in stores
        DB::table('stores')
            ->where('city', 'like', '%Akmaty%')
            ->update(['city' => DB::raw("REPLACE(city, 'Akmaty', 'Almaty')")]);

        DB::table('stores')
            ->where('address', 'like', '%Akmaty%')
            ->update(['address' => DB::raw("REPLACE(address, 'Akmaty', 'Almaty')")]);

        // Remove fake data
        DB::table('products')->where('name', 'like', '%illum quia%')->delete();
        DB::table('categories')->where('name', 'like', '%illum quia%')->delete();
        DB::table('favorites')->whereIn('product_id', function ($query) {
            $query->select('id')->from('products')->where('name', 'like', '%illum quia%');
        })->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
