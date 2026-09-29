const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const reply = (data, status = 200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders }
});

async function setup(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    hotel TEXT,
    room_number TEXT,
    trip TEXT NOT NULL,
    trip_date TEXT NOT NULL,
    adults INTEGER NOT NULL DEFAULT 1,
    children INTEGER NOT NULL DEFAULT 0,
    total_price REAL,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    status TEXT DEFAULT 'new'
  )`).run();
}

function makeCode() {
  const d = new Date().toISOString().slice(0,10).replaceAll("-", "");
  const r = Math.random().toString(36).slice(2,7).toUpperCase();
  return `SH-${d}-${r}`;
}

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers: corsHeaders });

      if (!env.db)
        return reply({ ok:false, error:"D1 binding 'db' is not connected" }, 500);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/" && request.method === "GET")
        return reply({ ok:true, service:"SharmHub API", message:"SharmHub API is running" });

      if (path === "/health" && request.method === "GET") {
        await setup(env.db);
        return reply({ ok:true, database:"connected" });
      }

      if (path === "/bookings" && request.method === "POST") {
        await setup(env.db);
        let b;
        try { b = await request.json(); }
        catch { return reply({ok:false,error:"Invalid JSON"},400); }

        const name = String(b.customer_name || b.name || "").trim();
        const phone = String(b.phone || "").trim();
        const trip = String(b.trip || "").trim();
        const date = String(b.trip_date || b.date || "").trim();

        if (!name || !phone || !trip || !date)
          return reply({ok:false,error:"Required: customer_name, phone, trip, trip_date"},400);

        const code = makeCode();
        await env.db.prepare(`INSERT INTO bookings
          (booking_code,created_at,customer_name,phone,hotel,room_number,trip,trip_date,
           adults,children,total_price,currency,notes,status)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'new')`)
          .bind(code,new Date().toISOString(),name,phone,
            String(b.hotel||""),String(b.room_number||b.room||""),trip,date,
            Math.max(0,parseInt(b.adults ?? 1)||0),
            Math.max(0,parseInt(b.children ?? 0)||0),
            b.total_price === "" || b.total_price == null ? null : Number(b.total_price),
            String(b.currency||"USD").toUpperCase(),String(b.notes||""))
          .run();

        return reply({ok:true,message:"Booking saved successfully",booking_code:code},201);
      }

      if (path === "/bookings" && request.method === "GET") {
        await setup(env.db);
        const r = await env.db.prepare("SELECT * FROM bookings ORDER BY id DESC LIMIT 100").all();
        return reply({ok:true,bookings:r.results||[]});
      }

      return reply({ok:false,error:"Not found"},404);
    } catch (e) {
      return reply({ok:false,error:"Server error",details:String(e?.message||e)},500);
    }
  }
};
