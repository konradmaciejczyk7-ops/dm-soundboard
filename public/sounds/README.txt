JAK DODAĆ WBUDOWANE DŹWIĘKI
===========================

1. Wrzuć plik do odpowiedniego folderu:
     ambient/   – zapętlone tła (deszcz, tawerna...)
     sfx/<kategoria>/ – efekty jednorazowe. Przyciski tworzą się SAME po odświeżeniu:
                      pliki o tej samej nazwie i innym numerze na końcu to jeden
                      przycisk z wariantami (losowany przy każdym kliknięciu):
                        coins-1.wav, coins-2.wav, coins-7.ogg  → przycisk "Coins"
                        dragon-f1.wav … dragon-f24.wav         → przycisk "Dragon"
                        item-get.wav (bez numeru)              → przycisk "Item Get"
                      Kategoria = nazwa folderu (nowy folder = nowa kolumna).
     music/<nazwa>/ – lokalna muzyka: każdy podfolder to playlista
                      (np. music/walka/, music/tawerna/). Nie trzeba nic wpisywać
                      w manifest.json – po odświeżeniu strony folder pojawi się
                      w ⚙️ (edycja nastrojów) jako źródło "Lokalne pliki".
                      Unikaj znaku # w nazwach plików.

2. Ambient dopisz w manifest.json:
     { "id": "campfire", "name": "Campfire", "emoji": "🔥", "file": "ambient/campfire.wav", "volume": 0.6 }
   Efektu NIE trzeba dopisywać. Wpis w "sfx" jest potrzebny tylko, żeby zmienić
   nazwę, emoji, głośność lub kategorię – "id" = nazwa pliku bez numeru:
     { "id": "explosion", "name": "Big Boom", "emoji": "💥", "category": "combat", "volume": 0.85, "loud": true }
   "files" jest opcjonalne – tylko dla plików o innej nazwie niż id.
   "loud": true – efekt ścisza muzykę (ducking). "randomize": false – bez losowej zmiany wysokości.
   Obsługiwane formaty: mp3, ogg, wav, m4a/aac, flac (zależnie od przeglądarki).

3. Odśwież stronę. Wpis bez pliku nie pojawi się w aplikacji; jeśli plik
   nie da się wczytać, kafelek pokaże "błąd pliku".

Wskazówki do ambientu:
- Najlepiej pętle 30 s – 3 min. Cały plik jest dekodowany do pamięci
  (3 min stereo ≈ 70 MB RAM), więc unikaj godzinnych nagrań.
- Zwykłe nagranie (WAV) zamienisz w bezszwową 60-sekundową pętlę
  z wyrównaną głośnością poleceniem (z folderu dm-soundboard):
      node scripts/audio-tools.mjs loop "surowe.wav" public/sounds/ambient/rain.wav 60

Wskazówki do efektów:
- Plik z serią kilku uderzeń/krzyków potniesz na osobne warianty:
      node scripts/audio-tools.mjs split "seria.wav" public/sounds/sfx/combat/sword-hit-x
  (powstaną sword-hit-x-1.wav, -2.wav… – same złożą się w jeden przycisk)

Darmowe źródła (zawsze sprawdź licencję konkretnego pliku!):
- Freesound            – freesound.org (filtr licencji: CC0; CC-BY wymaga podania autora)
- Pixabay Sound Effects – pixabay.com/sound-effects
- Sonniss GDC Bundle   – sonniss.com/gameaudiogdc (darmowe paczki royalty-free)
- Kenney               – kenney.nl/assets (CC0)
- BBC Sound Effects    – sound-effects.bbcrewind.co.uk (licencja RemArc: użytek prywatny)
- Tabletop Audio       – tabletopaudio.com (ambienty pod RPG, do domowych sesji)
- Muzyka: incompetech.com (Kevin MacLeod, CC-BY)
