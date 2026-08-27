<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=120');

$cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'karhutla-aqi-station.json';
$cacheTtl = 180;

if (is_file($cacheFile) && (time() - filemtime($cacheFile) < $cacheTtl)) {
    $cached = file_get_contents($cacheFile);
    if ($cached !== false && $cached !== '') {
        echo $cached;
        exit;
    }
}

function aqi_http_get($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, array(
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 14,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_HTTPHEADER => array(
                'Accept: application/json,text/html;q=0.9,*/*;q=0.8',
                'User-Agent: KarhutlaCommandCenter/1.0'
            ),
        ));
        $body = curl_exec($ch);
        $code = intval(curl_getinfo($ch, CURLINFO_HTTP_CODE));
        curl_close($ch);
        if ($body !== false && $code >= 200 && $code < 300) {
            return $body;
        }
        return false;
    }

    $ctx = stream_context_create(array(
        'http' => array(
            'timeout' => 14,
            'header' => "Accept: application/json,text/html\r\nUser-Agent: KarhutlaCommandCenter/1.0\r\n",
        ),
    ));
    $body = @file_get_contents($url, false, $ctx);
    return $body === false ? false : $body;
}

function aqi_bmkg_province($name) {
    static $map = array(
        'Samarinda' => 'Kalimantan Timur',
        'Tanjung Harapan' => 'Kalimantan Utara',
        'Palangkaraya' => 'Kalimantan Tengah',
        'Pangkalanbun' => 'Kalimantan Tengah',
        'Banjarbaru' => 'Kalimantan Selatan',
        'Kotabaru' => 'Kalimantan Selatan',
        'Kubu Raya' => 'Kalimantan Barat',
        'Mempawah' => 'Kalimantan Barat',
        'Sintang' => 'Kalimantan Barat',
        'Kemayoran' => 'DKI Jakarta',
        'Sleman' => 'DI Yogyakarta',
        'Semarang' => 'Jawa Tengah',
        'Malang' => 'Jawa Timur',
        'Medan' => 'Sumatera Utara',
        'Pekanbaru' => 'Riau',
        'Muaro Jambi' => 'Jambi',
        'Kota Jambi' => 'Jambi',
        'Musi 2 Palembang' => 'Sumatera Selatan',
        'Talang Betutu Palembang' => 'Sumatera Selatan',
        'Bengkulu' => 'Bengkulu',
        'Pesawaran' => 'Lampung',
        'Batam' => 'Kepulauan Riau',
        'Indrapuri' => 'Aceh',
        'Kototabang' => 'Sumatera Barat',
        'Maros' => 'Sulawesi Selatan',
        'Lore Lindu' => 'Sulawesi Tengah',
        'Sorong' => 'Papua Barat Daya',
    );
    return isset($map[$name]) ? $map[$name] : '';
}

function aqi_title_case($value) {
    $text = trim(strval($value));
    if ($text === '') {
        return '';
    }
    return ucwords(strtolower($text));
}

function aqi_num($value) {
    if ($value === null || $value === '') {
        return null;
    }
    if (is_numeric($value)) {
        return floatval($value);
    }
    return null;
}

function aqi_ispu_from_pm25($pm25) {
    $xp = aqi_num($pm25);
    if ($xp === null) {
        return null;
    }
    $breaks = array(
        array(0, 15.5, 0, 50),
        array(15.5, 55.4, 51, 100),
        array(55.4, 150.4, 101, 200),
        array(150.4, 250.4, 201, 300),
        array(250.4, 500, 301, 400),
    );
    foreach ($breaks as $b) {
        if ($xp <= $b[1] || $b[1] === 500) {
            $span = $b[1] - $b[0];
            if ($span <= 0) {
                return intval($b[2]);
            }
            $ispu = (($b[3] - $b[2]) / $span) * ($xp - $b[0]) + $b[2];
            return intval(round($ispu));
        }
    }
    return 401;
}

function aqi_nuxt_get($data, $value) {
    if (is_int($value) && array_key_exists($value, $data) && !is_array($data[$value])) {
        return $data[$value];
    }
    return $value;
}

function aqi_parse_bmkg($html) {
    $out = array();
    if (!is_string($html) || $html === '') {
        return $out;
    }
    if (!preg_match('/id="__NUXT_DATA__"[^>]*>(.*?)<\\/script>/s', $html, $m)) {
        return $out;
    }
    $payload = json_decode($m[1], true);
    if (!is_array($payload)) {
        return $out;
    }
    foreach ($payload as $item) {
        if (!is_array($item) || !isset($item['LOKASI'], $item['PM25'], $item['nama_file'])) {
            continue;
        }
        $file = aqi_nuxt_get($payload, $item['nama_file']);
        $name = aqi_title_case(aqi_nuxt_get($payload, $item['LOKASI']));
        $pm25 = aqi_num(aqi_nuxt_get($payload, $item['PM25']));
        if ($name === '' || $pm25 === null) {
            continue;
        }
        $id = is_string($file) ? preg_replace('/\\.xml$/i', '', $file) : '';
        if ($id === '') {
            $id = strtolower(preg_replace('/\\s+/', '-', $name));
        }
        $hour = aqi_nuxt_get($payload, isset($item['JAM']) ? $item['JAM'] : null);
        $hour = is_numeric($hour) ? str_pad(strval(intval($hour)), 2, '0', STR_PAD_LEFT) . ':00' : '';
        $out[] = array(
            'id' => 'bmkg:' . $id,
            'agency' => 'BMKG',
            'name' => $name,
            'city' => $name,
            'province' => aqi_bmkg_province($name),
            'pm25' => $pm25,
            'pm10' => null,
            'ispu' => aqi_ispu_from_pm25($pm25),
            'category' => aqi_title_case(aqi_nuxt_get($payload, isset($item['KONDISI']) ? $item['KONDISI'] : '')),
            'time' => $hour,
            'lat' => aqi_num(aqi_nuxt_get($payload, isset($item['LAT']) ? $item['LAT'] : null)),
            'lon' => aqi_num(aqi_nuxt_get($payload, isset($item['LON']) ? $item['LON'] : null)),
        );
    }
    return $out;
}

function aqi_parse_klhk($json) {
    $out = array();
    $data = json_decode($json, true);
    if (!is_array($data) || !isset($data['rows']) || !is_array($data['rows'])) {
        return $out;
    }
    foreach ($data['rows'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (!empty($row['is_maintenance'])) {
            continue;
        }
        if (isset($row['stasiun_show']) && strval($row['stasiun_show']) === '0') {
            continue;
        }
        $id = isset($row['id_stasiun']) ? trim(strval($row['id_stasiun'])) : '';
        $name = isset($row['nama']) ? trim(strval($row['nama'])) : '';
        if ($id === '' || $name === '') {
            continue;
        }
        $cat = '';
        if (isset($row['cat']) && $row['cat'] !== '') {
            $cat = aqi_title_case($row['cat']);
        } elseif (isset($row['kategori']['nilai'])) {
            $cat = aqi_title_case($row['kategori']['nilai']);
        }
        $out[] = array(
            'id' => 'klhk:' . $id,
            'agency' => 'KLHK',
            'name' => $name,
            'city' => isset($row['kota']) ? trim(strval($row['kota'])) : '',
            'province' => isset($row['provinsi']) ? trim(strval($row['provinsi'])) : '',
            'pm25' => aqi_num(isset($row['a_pm25']) ? $row['a_pm25'] : null),
            'pm10' => aqi_num(isset($row['a_pm10']) ? $row['a_pm10'] : null),
            'ispu' => aqi_num(isset($row['val']) ? $row['val'] : (isset($row['t_pm25']) ? $row['t_pm25'] : null)),
            'category' => $cat,
            'time' => isset($row['waktu']) ? trim(strval($row['waktu'])) : '',
            'lat' => aqi_num(isset($row['lat']) ? $row['lat'] : null),
            'lon' => aqi_num(isset($row['lon']) ? $row['lon'] : null),
        );
    }
    return $out;
}

$klhk = array();
$bmkg = array();
$errors = array();

$klhkRaw = aqi_http_get('https://ispu.kemenlh.go.id/apimobile/v1/getStations');
if ($klhkRaw === false) {
    $errors[] = 'KLHK tidak merespons.';
} else {
    $klhk = aqi_parse_klhk($klhkRaw);
    if (!$klhk) {
        $errors[] = 'Data stasiun KLHK kosong.';
    }
}

$bmkgRaw = aqi_http_get('https://www.bmkg.go.id/kualitas-udara/pm25');
if ($bmkgRaw === false) {
    $errors[] = 'BMKG tidak merespons.';
} else {
    $bmkg = aqi_parse_bmkg($bmkgRaw);
    if (!$bmkg) {
        $errors[] = 'Data stasiun BMKG kosong.';
    }
}

$payload = array(
    'ok' => (count($klhk) + count($bmkg)) > 0,
    'fetched_at' => date('c'),
    'stations' => array_merge($bmkg, $klhk),
    'counts' => array('bmkg' => count($bmkg), 'klhk' => count($klhk)),
    'errors' => $errors,
);

$json = json_encode($payload, JSON_UNESCAPED_UNICODE);
if ($json === false) {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'stations' => array(), 'error' => 'Gagal menyusun data stasiun.'));
    exit;
}

if ($payload['ok']) {
    @file_put_contents($cacheFile, $json);
}

echo $json;
