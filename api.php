<?php
/**
 * Pulse API — small server-side proxy so the browser never needs API keys.
 * Endpoints (GET):
 *   ?a=quotes&s=AAPL,MSFT      live-ish quotes + intraday sparkline
 *   ?a=chart&s=AAPL&r=1mo      price history for one symbol
 *   ?a=search&q=apple          symbol search
 *   ?a=snews&s=AAPL            headlines for one symbol
 *   ?a=news&c=top|markets|world|business|tech|sport|science
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function out($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function cache_dir(): string {
    $d = sys_get_temp_dir() . '/pulse_cache';
    if (!is_dir($d)) @mkdir($d, 0700, true);
    return $d;
}

function cached(string $key, int $ttl, callable $fn) {
    $f = cache_dir() . '/' . sha1($key) . '.json';
    if (is_file($f) && (time() - filemtime($f)) < $ttl) {
        $v = json_decode((string)file_get_contents($f), true);
        if ($v !== null) return $v;
    }
    $v = $fn();
    if ($v !== null && $v !== false) @file_put_contents($f, json_encode($v));
    elseif (is_file($f)) { // serve stale on failure
        $s = json_decode((string)file_get_contents($f), true);
        if ($s !== null) return $s;
    }
    return $v;
}

function curl_handle(string $url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => UA,
        CURLOPT_HTTPHEADER => ['Accept: application/json, application/rss+xml, application/xml, text/xml, */*'],
    ]);
    return $ch;
}

function fetch(string $url): ?string {
    $ch = curl_handle($url);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($body !== false && $code >= 200 && $code < 300) ? $body : null;
}

/** Fetch many URLs in parallel. Returns [key => body|null]. */
function fetch_many(array $urls): array {
    $mh = curl_multi_init();
    $hs = [];
    foreach ($urls as $k => $u) { $hs[$k] = curl_handle($u); curl_multi_add_handle($mh, $hs[$k]); }
    do { $st = curl_multi_exec($mh, $running); if ($running) curl_multi_select($mh, 1.0); }
    while ($running && $st === CURLM_OK);
    $res = [];
    foreach ($hs as $k => $h) {
        $code = curl_getinfo($h, CURLINFO_HTTP_CODE);
        $body = curl_multi_getcontent($h);
        $res[$k] = ($code >= 200 && $code < 300 && $body) ? $body : null;
        curl_multi_remove_handle($mh, $h); curl_close($h);
    }
    curl_multi_close($mh);
    return $res;
}

function clean_symbols(string $s, int $max = 30): array {
    $out = [];
    foreach (explode(',', strtoupper($s)) as $sym) {
        $sym = trim($sym);
        if ($sym !== '' && preg_match('/^[A-Z0-9.\-\^=]{1,15}$/', $sym)) $out[] = $sym;
    }
    return array_slice(array_values(array_unique($out)), 0, $max);
}

function chart_url(string $sym, string $range, string $interval): string {
    return 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($sym)
        . '?range=' . $range . '&interval=' . $interval . '&includePrePost=false';
}

function parse_chart(?string $body): ?array {
    if (!$body) return null;
    $j = json_decode($body, true);
    $r = $j['chart']['result'][0] ?? null;
    if (!$r) return null;
    $m = $r['meta'] ?? [];
    $ts = $r['timestamp'] ?? [];
    $cl = $r['indicators']['quote'][0]['close'] ?? [];
    $pts = [];
    foreach ($ts as $i => $t) { if (isset($cl[$i]) && $cl[$i] !== null) $pts[] = [$t, round((float)$cl[$i], 4)]; }
    $price = $m['regularMarketPrice'] ?? (count($pts) ? end($pts)[1] : null);
    $prev = $m['chartPreviousClose'] ?? $m['previousClose'] ?? null;
    return [
        'symbol' => $m['symbol'] ?? null,
        'name' => $m['shortName'] ?? $m['longName'] ?? ($m['symbol'] ?? ''),
        'currency' => $m['currency'] ?? 'USD',
        'exchange' => $m['fullExchangeName'] ?? $m['exchangeName'] ?? '',
        'price' => $price,
        'prev' => $prev,
        'change' => ($price !== null && $prev) ? $price - $prev : null,
        'changePct' => ($price !== null && $prev) ? (($price - $prev) / $prev) * 100 : null,
        'dayHigh' => $m['regularMarketDayHigh'] ?? null,
        'dayLow' => $m['regularMarketDayLow'] ?? null,
        'volume' => $m['regularMarketVolume'] ?? null,
        'high52' => $m['fiftyTwoWeekHigh'] ?? null,
        'low52' => $m['fiftyTwoWeekLow'] ?? null,
        'time' => $m['regularMarketTime'] ?? null,
        'state' => $m['currentTradingPeriod'] ?? null,
        'points' => $pts,
    ];
}

/** Parse RSS/Atom into a flat list of items. */
function parse_feed(?string $xml, string $source): array {
    if (!$xml) return [];
    libxml_use_internal_errors(true);
    $x = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NONET);
    if (!$x) return [];
    $items = [];
    $nodes = isset($x->channel->item) ? $x->channel->item : ($x->entry ?? []);
    foreach ($nodes as $it) {
        $title = trim(html_entity_decode(strip_tags((string)$it->title), ENT_QUOTES | ENT_HTML5));
        $link = (string)$it->link;
        if ($link === '' && isset($it->link['href'])) $link = (string)$it->link['href'];
        $desc = trim(html_entity_decode(strip_tags((string)($it->description ?? $it->summary ?? '')), ENT_QUOTES | ENT_HTML5));
        $date = (string)($it->pubDate ?? $it->published ?? $it->updated ?? '');
        $img = null;
        $media = $it->children('http://search.yahoo.com/mrss/');
        if (isset($media->thumbnail)) $img = (string)$media->thumbnail->attributes()->url;
        if (!$img && isset($media->content)) {
            foreach ($media->content as $mc) { $a = $mc->attributes(); if (isset($a->url)) { $img = (string)$a->url; break; } }
        }
        if (!$img && isset($it->enclosure)) {
            $a = $it->enclosure->attributes();
            if (isset($a->url) && str_starts_with((string)($a->type ?? 'image'), 'image')) $img = (string)$a->url;
        }
        if ($img) $img = preg_replace('#/standard/\d+/#', '/standard/480/', $img); // sharper BBC thumbs
        if ($title === '' || !preg_match('#^https?://#', $link)) continue;
        $items[] = [
            'title' => $title,
            'link' => $link,
            'summary' => mb_substr($desc, 0, 220),
            'time' => $date ? (strtotime($date) ?: null) : null,
            'image' => $img,
            'source' => $source,
        ];
    }
    return $items;
}

const FEEDS = [
    'top' => [
        ['BBC News', 'https://feeds.bbci.co.uk/news/rss.xml'],
        ['The Guardian', 'https://www.theguardian.com/world/rss'],
    ],
    'markets' => [
        ['CNBC', 'https://www.cnbc.com/id/10000664/device/rss/rss.html'],
        ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories'],
        ['Yahoo Finance', 'https://finance.yahoo.com/news/rssindex'],
    ],
    'business' => [
        ['BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml'],
        ['CNBC', 'https://www.cnbc.com/id/10001147/device/rss/rss.html'],
    ],
    'world' => [
        ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
        ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
    ],
    'tech' => [
        ['BBC Tech', 'https://feeds.bbci.co.uk/news/technology/rss.xml'],
        ['The Verge', 'https://www.theverge.com/rss/index.xml'],
        ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index'],
    ],
    'sport' => [
        ['BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml'],
        ['ESPN', 'https://www.espn.com/espn/rss/news'],
    ],
    'science' => [
        ['BBC Science', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'],
    ],
];

$a = $_GET['a'] ?? '';

switch ($a) {
    case 'quotes': {
        $syms = clean_symbols((string)($_GET['s'] ?? ''));
        if (!$syms) out(['error' => 'no symbols'], 400);
        $data = cached('q:' . implode(',', $syms), 45, function () use ($syms) {
            $urls = [];
            foreach ($syms as $s) $urls[$s] = chart_url($s, '1d', '5m');
            $res = fetch_many($urls);
            $out = [];
            foreach ($syms as $s) {
                $q = parse_chart($res[$s] ?? null);
                if ($q) { $q['symbol'] = $q['symbol'] ?: $s; $out[] = $q; }
                else $out[] = ['symbol' => $s, 'error' => true];
            }
            return $out;
        });
        out(['quotes' => $data, 'at' => time()]);
    }
    case 'chart': {
        $syms = clean_symbols((string)($_GET['s'] ?? ''), 1);
        if (!$syms) out(['error' => 'no symbol'], 400);
        $ranges = ['1d' => '5m', '5d' => '30m', '1mo' => '1d', '6mo' => '1d', '1y' => '1d', '5y' => '1wk'];
        $r = (string)($_GET['r'] ?? '1d');
        if (!isset($ranges[$r])) $r = '1d';
        $data = cached("c:{$syms[0]}:$r", $r === '1d' ? 60 : 900, fn() => parse_chart(fetch(chart_url($syms[0], $r, $ranges[$r]))));
        if (!$data) out(['error' => 'unavailable'], 502);
        out($data);
    }
    case 'search': {
        $q = trim((string)($_GET['q'] ?? ''));
        if ($q === '' || mb_strlen($q) > 40) out(['results' => []]);
        $data = cached('s:' . strtolower($q), 3600, function () use ($q) {
            $b = fetch('https://query2.finance.yahoo.com/v1/finance/search?q=' . rawurlencode($q) . '&quotesCount=8&newsCount=0&listsCount=0');
            if (!$b) return null;
            $j = json_decode($b, true);
            $out = [];
            foreach ($j['quotes'] ?? [] as $r) {
                if (empty($r['symbol']) || !in_array($r['quoteType'] ?? '', ['EQUITY', 'ETF', 'INDEX', 'CRYPTOCURRENCY', 'MUTUALFUND', 'CURRENCY', 'FUTURE'], true)) continue;
                $out[] = ['symbol' => $r['symbol'], 'name' => $r['shortname'] ?? $r['longname'] ?? $r['symbol'], 'type' => $r['quoteType'], 'exchange' => $r['exchDisp'] ?? ''];
            }
            return $out;
        });
        out(['results' => $data ?: []]);
    }
    case 'snews': {
        $syms = clean_symbols((string)($_GET['s'] ?? ''), 1);
        if (!$syms) out(['items' => []]);
        $data = cached('sn:' . $syms[0], 600, fn() => parse_feed(fetch('https://feeds.finance.yahoo.com/rss/2.0/headline?s=' . rawurlencode($syms[0]) . '&region=US&lang=en-US'), 'Yahoo Finance') ?: null);
        out(['items' => array_slice($data ?: [], 0, 12)]);
    }
    case 'news': {
        $c = (string)($_GET['c'] ?? 'top');
        if (!isset(FEEDS[$c])) $c = 'top';
        $data = cached('n:' . $c, 600, function () use ($c) {
            $urls = []; $names = [];
            foreach (FEEDS[$c] as $i => [$name, $url]) { $urls[$i] = $url; $names[$i] = $name; }
            $res = fetch_many($urls);
            $all = []; $seen = [];
            foreach ($res as $i => $body) {
                foreach (parse_feed($body, $names[$i]) as $it) {
                    $k = strtolower(preg_replace('/\W+/', '', $it['title']));
                    if (isset($seen[$k])) continue;
                    $seen[$k] = 1; $all[] = $it;
                }
            }
            usort($all, fn($x, $y) => ($y['time'] ?? 0) <=> ($x['time'] ?? 0));
            return $all ? array_slice($all, 0, 40) : null;
        });
        out(['items' => $data ?: [], 'category' => $c]);
    }
    case 'diag': {
        $out = [];
        foreach (['q1' => 'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m', 'q2' => 'https://query2.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=5m', 'stooq' => 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvp&h&e=csv', 'fc' => 'https://fc.yahoo.com/'] as $k => $u) {
            $ch = curl_handle($u); curl_setopt($ch, CURLOPT_HEADER, true); $b = curl_exec($ch);
            $out[$k] = ['code' => curl_getinfo($ch, CURLINFO_HTTP_CODE), 'err' => curl_error($ch), 'head' => substr((string)$b, 0, 600)]; curl_close($ch);
        }
        out($out);
    }
    default:
        out(['ok' => true, 'endpoints' => ['quotes', 'chart', 'search', 'snews', 'news']]);
}
