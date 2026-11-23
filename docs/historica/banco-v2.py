"""
Banco v2 de la encuesta histórica: preguntas nuevas y sus posiciones con cita literal.

Uso:
  python3 docs/historica/banco-v2.py --verificar <carpeta_con_textos_fuente>   comprueba que cada cita está en su fuente
  python3 docs/historica/banco-v2.py --escribir                                añade las filas a citas/ y genera preguntas-v2.json

Las 15 preguntas del banco v1 (A…U) siguen igual y son el nivel 1. Aquí van las nuevas (V01…).
El nivel de cada pregunta nueva NO se fija a mano: lo calcula el script de carga con las posiciones evaluables
(2 o más programas → nivel 2; uno → nivel 3).

Notación: + / − firme (±2) · (+) / (−) débil (±1) · ~ ambigua (no puntúa).
Cita: texto literal del original. Si hay un salto, se marca con […] y cada tramo se verifica por separado.
Traducción: None si el original está en castellano.
"""
import json, os, re, sys, unicodedata

# dim: regimen (h1) · sociedad (h2) · economia (h3) · trabajo (h4)
# bal: True si «de acuerdo» es la postura de mercado, libertad u orden (cupo de contrapeso)
Q = [
 # ── Régimen y nación ──────────────────────────────────────────────
 dict(code='V01', dim='regimen', bal=False, text='La representación política debe organizarse por profesiones y corporaciones, en lugar de por partidos.', pos={
  'FASCI19': ('(+)', "La formazione di Consigli Nazionali tecnici del lavoro, dell'industria, dei trasporti, dell'igiene sociale, delle comunicazioni ecc. eletti dalle collettività professionali o di mestiere, con poteri legislativi", 'La formación de Consejos Nacionales técnicos del trabajo, la industria, los transportes, la higiene social, las comunicaciones, etc., elegidos por las colectividades profesionales o de oficio, con poderes legislativos', 'Problema político, e'),
  'PNF21': ('(+)', 'Lo Stato deve investire di capacità e di responsabilità le Associazioni conferendo anche alle corporazioni professionali ed economiche diritto di elettorato al corpo dei Consigli Tecnici Nazionali', 'El Estado debe dar capacidad y responsabilidad a las asociaciones, concediendo también a las corporaciones profesionales y económicas derecho a elegir los Consejos Técnicos Nacionales', 'Lo Stato'),
  'NSDAP20': ('(+)', 'Die Bildung von Stände- und Berufskammern zur Durchführung der vom Reich erlassenen Rahmengesetze in den einzelnen Bundesstaaten.', 'La creación de cámaras de estamentos y profesiones para aplicar en cada estado federado las leyes marco del Reich.', 'Punto 25'),
  'FE34': ('+', 'Todos los españoles participarán en él al través de su función familiar, municipal y sindical. Nadie participará al través de los partidos políticos.', None, 'Punto 6'),
  'CEDA33': ('(+)', 'cuanto en la organización corporativa que responda al carácter orgánico de la sociedad', None, 'II (BOE, cita del programa)'),
 }),
 dict(code='V02', dim='regimen', bal=False, text='Es legítimo conquistar el poder fuera de las urnas, mediante la acción en la calle o la revolución.', pos={
  'FE34': ('+', 'Para implantarlo, en pugna con las resistencias del orden vigente, aspira a la revolución nacional. Su estilo preferirá lo directo, ardiente y combativo.', None, 'Punto 26'),
  'BN34': ('+', 'como campo de acción, la tribuna, la prensa, el libro y la calle, o sea, la actividad extraparlamentaria', None, 'Junta, p. 81'),
  'TESIS17': ('(+)', 'la necesidad de que todo el poder del Estado pase a los Soviets de diputados obreros', None, 'Tesis 4'),
 }),
 dict(code='V03', dim='regimen', bal=False, text='Un partido puede tener su propia milicia armada.', pos={
  'PNF21': ('+', "Nel campo dell'organizzazione di combattimento il Partito Nazionale Fascista forma un tutto unico con le sue squadre: milizia volontaria al servizio dello Stato nazionale", 'En el terreno de la organización de combate, el Partido Nacional Fascista forma un todo con sus escuadras: milicia voluntaria al servicio del Estado nacional', 'Organizzazione'),
 }),
 dict(code='V04', dim='regimen', bal=False, text='El país debería restaurar la monarquía.', pos={
  'BN34': ('(+)', '¿Quiere o no España la restauración de la gloriosa bandera bicolor como enseña patria?', None, 'Junta, p. 82. Pregunta retórica: la bandera bicolor es la de la monarquía'),
 }),
 dict(code='V05', dim='regimen', bal=False, text='Debe suprimirse el Senado.', pos={
  'FASCI19': ('+', "L'abolizione del Senato.", 'La abolición del Senado.', 'Problema político, c'),
 }),
 dict(code='V06', dim='regimen', bal=False, text='Se debe poder votar a partir de los 18 años.', pos={
  'FASCI19': ('+', 'Il minimo di età per gli elettori abbassato ai 18 anni', 'La edad mínima de los electores, rebajada a los 18 años', 'Problema político, b'),
 }),
 dict(code='V07', dim='regimen', bal=False, text='Los cargos públicos deben ser elegidos, revocables en cualquier momento y cobrar como un trabajador cualificado.', pos={
  'TESIS17': ('+', 'La remuneración de los funcionarios, todos ellos elegibles y amovibles en cualquier momento, no deberá exceder del salario medio de un obrero calificado.', None, 'Tesis 5'),
  'PCR19': ('(+)', 'to elect and recall deputies in a manner easiest and most accessible to the workers and peasants', 'elegir y revocar a los diputados del modo más fácil y accesible para obreros y campesinos', 'Política general, 5'),
 }),
 dict(code='V08', dim='regimen', bal=False, text='Los usureros y los especuladores deben ser castigados con la pena de muerte.', pos={
  'NSDAP20': ('+', 'Gemeine Volksverbrecher, Wucherer, Schieber usw. sind mit dem Tode zu bestrafen', 'Los criminales contra el pueblo, los usureros, los especuladores, etc., deben ser castigados con la muerte', 'Punto 18'),
 }),
 dict(code='V09', dim='regimen', bal=False, text='El Estado debe poder prohibir obras de arte, libros y espectáculos que considere dañinos para el pueblo.', pos={
  'NSDAP20': ('+', 'Wir fordern den gesetzlichen Kampf gegen eine Kunst- und Literaturrichtung, die einen zersetzenden Einfluß auf unser Volksleben ausübt', 'Exigimos la lucha legal contra una corriente del arte y la literatura que ejerce una influencia disolvente sobre la vida de nuestro pueblo', 'Punto 23'),
 }),
 dict(code='V10', dim='regimen', bal=False, text='La ciudadanía y los cargos públicos deben reservarse a quienes pertenecen al pueblo por su origen.', pos={
  'NSDAP20': ('+', 'Staatsbürger kann nur sein, wer Volksgenosse ist. Volksgenosse kann nur sein, wer deutschen Blutes ist', 'Solo puede ser ciudadano quien sea miembro del pueblo. Solo puede ser miembro del pueblo quien sea de sangre alemana', 'Punto 4'),
  'PCR19': ('−', 'to abolish all the privileges enjoyed by any national group, to establish complete equality of rights for all nationalities', 'abolir todos los privilegios de cualquier grupo nacional y establecer la plena igualdad de derechos de todas las nacionalidades', 'Cuestión nacional, 9'),
 }),
 dict(code='V11', dim='regimen', bal=False, text='Hay que cerrar la inmigración y expulsar a los inmigrantes llegados en los últimos años.', pos={
  'NSDAP20': ('+', 'Jede weitere Einwanderung Nichtdeutscher ist zu verhindern. Wir fordern, daß alle Nichtdeutschen, die seit 2. August 1914 in Deutschland eingewandert sind, sofort zum Verlassen des Reiches gezwungen werden.', 'Debe impedirse toda nueva inmigración de no alemanes. Exigimos que todos los no alemanes que han inmigrado a Alemania desde el 2 de agosto de 1914 sean obligados a abandonar el Reich de inmediato.', 'Punto 8'),
 }),
 dict(code='V12', dim='regimen', bal=False, text='Los tratados de paz impuestos tras una guerra deben anularse o revisarse.', pos={
  'NSDAP20': ('+', 'Aufhebung der Friedensverträge in Versailles und St. Germain', 'Anulación de los tratados de paz de Versalles y Saint-Germain', 'Punto 2'),
  'PNF21': ('(+)', 'I trattati internazionali vanno riveduti e modificati in quelle parti che si sono palesate inapplicabili', 'Los tratados internacionales deben revisarse y modificarse en las partes que se han mostrado inaplicables', 'Capisaldi di politica estera'),
 }),
 dict(code='V13', dim='regimen', bal=True, text='Un país no debe someter su política exterior a organismos internacionales.', pos={
  'PNF21': ('+', 'Il Fascismo non crede alla vitalità e ai principi che ispirano la cosí detta Società delle Nazioni', 'El fascismo no cree en la vitalidad ni en los principios que inspiran la llamada Sociedad de Naciones', 'Capisaldi di politica estera'),
  'FP36': ('−', 'Se orientará la política internacional en un sentido de adhesión a los principios y métodos de la Sociedad de Naciones.', None, 'FP, Política internacional'),
 }),
 dict(code='V14', dim='regimen', bal=False, text='Hay que impulsar la revolución en otros países.', pos={
  'TESIS17': ('+', 'Iniciativa de constituir una Internacional revolucionaria', None, 'Tareas del partido'),
  'PCR19': ('(+)', 'the new, Third, Communist International, of which the Communist Party of the Soviet Union is a detachment', 'la nueva, Tercera, Internacional Comunista, de la que el Partido Comunista es un destacamento', 'Introducción'),
 }),
 dict(code='V15', dim='sociedad', bal=False, text='El espíritu militar debe impregnar toda la vida de la nación.', pos={
  'FE34': ('+', 'haremos, a su imagen, que un sentido militar de la vida informe toda la existencia española', None, 'Punto 4'),
  'PNF21': ('+', 'la forma della Nazione Armata in cui ogni forza individuale, collettiva, economica, industriale e agricola sia compiutamente inquadrata al fine supremo della difesa degli interessi nazionali', 'la forma de la Nación Armada, en la que toda fuerza individual, colectiva, económica, industrial y agrícola esté plenamente encuadrada para el fin supremo de la defensa de los intereses nacionales', 'La difesa nazionale'),
  'CEDA33': ('(−)', 'España debe desarrollar una política militar orientada a dotar al país de medios de defensa activa en armonía con sus posibilidades económicas y su posición geográfica.', None, 'XIII, 1.ª (Junta)'),
 }),
 # ── Iglesia, escuela, justicia y sociedad ─────────────────────────
 dict(code='V16', dim='sociedad', bal=False, text='Deben confiscarse los bienes de las órdenes religiosas.', pos={
  'FASCI19': ('+', 'Il sequestro di tutti i beni delle Congregazioni religiose', 'La confiscación de todos los bienes de las congregaciones religiosas', 'Problema financiero, b'),
  'DER33': ('(−)', 'disposiciones confiscadoras de la propiedad y persecutorias de las personas, de las Asociaciones y de las creencias religiosas', None, 'p. 2, col. 1 (transcrito de la imagen)'),
 }),
 dict(code='V17', dim='sociedad', bal=False, text='La religión debe tener un lugar en la escuela, y las familias deben poder elegir una educación religiosa.', pos={
  'CEDA33': ('+', 'Se proclama el perfecto derecho de la familia a la educación de sus hijos y el supremo magisterio de la Iglesia', None, 'VII, 1.ª (Junta)'),
  'PCR19': ('−', 'absolutely secular education, i.e., free from any kind of religious influence', 'enseñanza absolutamente laica, es decir, libre de toda influencia religiosa', 'Educación, 12'),
  'FP36': ('(−)', 'por encima de razones confesionales y de clase social', None, 'FP, La enseñanza'),
 }),
 dict(code='V18', dim='sociedad', bal=False, text='El Estado debe pagar los estudios, también los superiores, a los alumnos capaces sin recursos.', pos={
  'NSDAP20': ('+', 'Wir fordern die Ausbildung geistig besonders veranlagter Kinder armer Eltern ohne Rücksicht auf deren Stand oder Beruf auf Staatskosten.', 'Exigimos que los niños especialmente dotados de padres pobres se formen a cargo del Estado, sin tener en cuenta su clase ni su profesión.', 'Punto 20'),
  'FE34': ('+', 'La cultura se organizará en forma de que no se malogre ningún talento por falta de medios económicos.', None, 'Punto 24'),
  'FP36': ('+', 'para asegurar el acceso a la enseñanza media y superior a la juventud obrera', None, 'FP, La enseñanza, 4.º'),
  'PCR19': ('+', 'The inauguration of free, compulsory, general and polytechnic education', 'La implantación de una enseñanza gratuita, obligatoria, general y politécnica', 'Educación, 12'),
 }),
 dict(code='V19', dim='sociedad', bal=False, text='La educación física debe ser obligatoria por ley.', pos={
  'NSDAP20': ('+', 'durch Herbeiführung der körperlichen Ertüchtigung mittels gesetzlicher Festlegung einer Turn- und Sportpflicht', 'mediante el fortalecimiento físico, con la obligación legal de hacer gimnasia y deporte', 'Punto 21'),
 }),
 dict(code='V20', dim='sociedad', bal=False, text='Los jóvenes deben recibir formación premilitar.', pos={
  'FE34': ('+', 'Todos los hombres recibirán una educación premilitar', None, 'Punto 23'),
  'PNF21': ('+', "il dovere dello Stato di provvedere esso all'istruzione premilitare", 'el deber del Estado de encargarse de la instrucción premilitar', 'Politica scolastica, 4'),
  'PCR19': ('+', 'It is necessary widely to extend military training to all proletarians and semi-proletarians, and to introduce the teaching of the corresponding subjects in the schools.', 'Hay que extender la instrucción militar a todos los proletarios y semiproletarios e introducir su enseñanza en las escuelas.', 'Militar, 10'),
 }),
 dict(code='V21', dim='sociedad', bal=False, text='El Estado puede movilizar obligatoriamente a los jóvenes para trabajos de interés nacional.', pos={
  'FE34': ('+', 'acudiendo a la forzosa movilización temporal de toda la juventud española para esta histórica tarea', None, 'Punto 20'),
 }),
 dict(code='V22', dim='sociedad', bal=False, text='Dentro del matrimonio, la mujer debe tener los mismos derechos que el marido.', pos={
  'PCR19': ('+', 'stamping out all traces of the former inequality', 'borrar todo rastro de la antigua desigualdad', 'Política general, 4 (desigualdad de la mujer en el matrimonio y la familia)'),
  'CEDA33': ('(−)', 'Las desigualdades de las leyes en materia civil y económica entre los dos sexos deben gradualmente desaparecer, sin perjuicio de la autoridad marital y de la jerarquía familiar.', None, 'VIII (Junta)'),
 }),
 dict(code='V23', dim='sociedad', bal=False, text='Las mujeres deben poder votar y ser elegidas.', pos={
  'FASCI19': ('+', 'voto ed eleggibilità per le donne', 'voto y elegibilidad para las mujeres', 'Problema político, a'),
 }),
 dict(code='V24', dim='sociedad', bal=False, text='Los pueblos y regiones deben tener derecho a separarse y formar su propio Estado.', pos={
  'PCR19': ('+', 'to recognize the right of colonies and dependent nations to separation', 'reconocer el derecho de las colonias y de las naciones dependientes a la separación', 'Cuestión nacional, 9'),
  'FE34': ('−', 'Todo separatismo es un crimen que no perdonaremos.', None, 'Punto 2'),
 }),
 dict(code='V25', dim='sociedad', bal=False, text='La sanidad debe ser pública.', pos={
  'PCR19': ('+', 'nationalization of drug stores, big privately owned hospitals and health resorts', 'nacionalización de las farmacias, los grandes hospitales privados y los balnearios', 'Sanidad, 25'),
  'FP36': ('(+)', 'Unificarán, bajo la dirección del Estado, las diversas instituciones de fundación privada', None, 'FP, Legislación social (asistencia pública, Beneficencia y Sanidad)'),
 }),
 dict(code='V26', dim='sociedad', bal=True, text='La cárcel debe servir sobre todo para castigar, más que para reeducar.', pos={
  'PCR19': ('−', 'to have the system of punishment finally replaced by a system of educational measures', 'que el sistema de castigos se sustituya finalmente por un sistema de medidas educativas', 'Justicia, 11'),
  'FP36': ('(−)', 'se humanizará el régimen de prisiones', None, 'FP, Restablecimiento…, 4.º'),
  'PNF21': ('~', 'La pena, mezzo di difesa della Società nazionale lesa nel diritto, deve adempiere normalmente la funzione intimidatrice ed emendatrice', 'La pena, medio de defensa de la sociedad nacional, debe cumplir normalmente la función intimidatoria y la de enmienda', 'La Giustizia'),
 }),
 dict(code='V27', dim='sociedad', bal=True, text='Los jueces deben ser profesionales independientes, no elegidos por votación.', pos={
  'PCR19': ('−', 'Judges elected of the toilers and only by the toilers', 'Jueces elegidos entre los trabajadores y solo por los trabajadores', 'Justicia, 11'),
  'FP36': ('(+)', 'La Justicia, una vez reorganizada, será dotada de las condiciones de independencia que promete la Constitución.', None, 'FP, Restablecimiento…, 4.º'),
 }),
 dict(code='V28', dim='sociedad', bal=False, text='La jurisdicción militar debe limitarse a los delitos militares.', pos={
  'FP36': ('+', 'Se limitarán los fueros especiales, singularmente el castrense, a los delitos netamente militares.', None, 'FP, Restablecimiento…, 4.º'),
  'PNF21': ('+', 'Vanno abolite le magistrature speciali.', 'Deben abolirse las jurisdicciones especiales.', 'La Giustizia'),
 }),
 dict(code='V29', dim='sociedad', bal=False, text='Hay que investigar y castigar los abusos de la policía.', pos={
  'FP36': ('+', 'Los casos de violencia de los agentes de la fuerza pública, acaecidos bajo el mando de los Gobiernos reaccionarios, aconsejan llevar a cabo la investigación de responsabilidades concretas hasta el esclarecimiento de la culpa individual y su castigo.', None, 'FP, Restablecimiento…, 5.º'),
 }),
 dict(code='V30', dim='sociedad', bal=False, text='El Estado debe apartar a los funcionarios, policías y militares que no sean leales al régimen.', pos={
  'FP36': ('+', 'El Cuerpo de Vigilancia se reorganizará con funcionarios aptos y de cumplida lealtad al régimen.', None, 'FP, Restablecimiento…, 5.º'),
  'BN34': ('(+)', 'El Ejército, escuela de ciudadanía, depurado por sus Tribunales de Honor', None, 'Junta, p. 82'),
 }),
 dict(code='V31', dim='sociedad', bal=False, text='Debe concederse una amplia amnistía a los presos políticos.', pos={
  'FP36': ('+', 'A conceder por ley una amplia amnistía de los delitos politicosociales cometidos posteriormente a noviembre de 1933', None, 'FP, Amnistía, 1.º'),
  'DER33': ('+', 'la concesión de una amplia y generosa amnistía', None, 'p. 2, col. 1 (transcrito de la imagen)'),
 }),
 # ── Propiedad y economía ──────────────────────────────────────────
 dict(code='V32', dim='economia', bal=True, text='La tierra debe repartirse en pequeñas propiedades familiares, no en grandes explotaciones colectivas.', pos={
  'FE34': ('+', 'Distribuyendo de nuevo la tierra cultivable para instituir la propiedad familiar', None, 'Punto 19'),
  'PNF21': ('+', 'La diffusione della piccola proprietà in quelle zone e per quelle coltivazioni che produttivamente lo consentano.', 'La difusión de la pequeña propiedad en las zonas y cultivos que lo permitan productivamente.', 'Le corporazioni, 5'),
  'CEDA33': ('+', 'Creación gradual de pequeños propietarios y patrimonios familiares.', None, 'XI, 5.ª, a (Junta)'),
  'FP36': ('~', 'Estimularán las formas de cooperación y fomentarán las explotaciones colectivas. Llevarán a cabo una política de asentamientos de familias campesinas', None, 'FP, El régimen agrario, 3.ª'),
  'PCR19': ('−', 'the organization of state farms, i.e., big socialist farms', 'la organización de granjas estatales, es decir, grandes explotaciones socialistas', 'Agricultura, 16'),
 }),
 dict(code='V33', dim='economia', bal=False, text='Quien cultiva una tierra arrendada durante años debe poder acceder a su propiedad.', pos={
  'FP36': ('+', 'el acceso a la propiedad de la tierra que se viniera cultivando durante cierto tiempo', None, 'FP, El régimen agrario, 3.ª'),
 }),
 dict(code='V34', dim='economia', bal=False, text='El Estado debe garantizar precios mínimos a los productos del campo.', pos={
  'FE34': ('+', 'Asegurando a todos los productos de la tierra un precio mínimo remunerador.', None, 'Punto 18'),
  'FP36': ('+', 'Revalorización de los productos de la tierra, especialmente del trigo y demás cereales', None, 'FP, El régimen agrario, 1.ª'),
 }),
 dict(code='V35', dim='economia', bal=False, text='Hay que proteger con aranceles la producción nacional.', pos={
  'FE34': ('+', 'Orientando la política arancelaria en sentido protector de la agricultura y de la ganadería.', None, 'Punto 18'),
  'FP36': ('(+)', 'las bases de la protección a la industria, comprendiendo las arancelarias', None, 'FP, El régimen industrial, 1.º'),
  'PNF21': ('~', "l'eventuale intervento statale, che si rendesse assolutamente necessario per proteggere taluni rami dell'industria agricola e manifatturiera da una troppo pericolosa concorrenza estera", 'la eventual intervención del Estado que fuera absolutamente necesaria para proteger algunas ramas de la industria agrícola y manufacturera de una competencia extranjera demasiado peligrosa', 'Politica finanziaria, 4'),
 }),
 dict(code='V36', dim='economia', bal=False, text='Hay que proteger al pequeño comercio frente a los grandes almacenes.', pos={
  'NSDAP20': ('+', 'Wir fordern die Schaffung eines gesunden Mittelstandes und seine Erhaltung. Sofortige Kommunalisierung der Groß-Warenhäuser und ihre Vermietung zu billigen Preisen an kleine Gewerbetreibende', 'Exigimos crear y mantener una clase media sana. Municipalización inmediata de los grandes almacenes y su alquiler a bajo precio a los pequeños comerciantes', 'Punto 16'),
  'FP36': ('+', 'Adoptar aquellas medidas necesarias de especial protección a la pequeña industria y al pequeño comercio.', None, 'FP, El régimen industrial, 3.º'),
 }),
 dict(code='V37', dim='economia', bal=False, text='Hay que confiscar los beneficios obtenidos con la guerra.', pos={
  'FASCI19': ('+', "il sequestro dell'85% dei profitti di guerra", 'la confiscación del 85 % de los beneficios de guerra', 'Problema financiero, c'),
  'NSDAP20': ('+', 'Wir fordern daher restlose Einziehung aller Kriegsgewinne.', 'Exigimos por ello la confiscación total de todos los beneficios de guerra.', 'Punto 12'),
 }),
 dict(code='V38', dim='economia', bal=True, text='Es legítimo cobrar intereses y otras rentas del capital.', pos={
  'NSDAP20': ('−', 'Abschaffung des arbeits- und mühelosen Einkommens. Brechung der Zinsknechtschaft.', 'Abolición de los ingresos obtenidos sin trabajo ni esfuerzo. Ruptura de la servidumbre del interés.', 'Punto 11'),
 }),
 dict(code='V39', dim='economia', bal=True, text='La economía debe dejarse a la iniciativa privada, no planificarse desde el Estado.', pos={
  'PNF21': ('+', 'un regime che spronando le iniziative e le energie individuali (le quali formano il fattore piú possente ed operoso della produzione economica) favorisca l\'accrescimento della ricchezza nazionale', 'un régimen que, estimulando las iniciativas y energías individuales (el factor más poderoso de la producción económica), favorezca el aumento de la riqueza nacional', 'Capisaldi di politica sociale'),
  'PCR19': ('−', 'uniting the entire economic activity of the country in a uniform national plan', 'unir toda la actividad económica del país en un plan nacional único', 'Economía, 15'),
 }),
 dict(code='V40', dim='economia', bal=True, text='Hay que equilibrar las cuentas públicas recortando gastos.', pos={
  'PNF21': ('+', 'Il risanamento dei bilanci dello Stato e degli enti pubblici locali, anche mediante rigorose economie', 'El saneamiento de las cuentas del Estado y de los entes locales, también mediante rigurosos ahorros', 'Politica finanziaria, obiettivi 1'),
  'CEDA33': ('(+)', 'infla temerariamente los gastos que no son inmediatamente reproductivos', None, 'X (BOE, cita del programa, contra el presupuesto de 1933)'),
  'FP36': ('(+)', 'sin acudir al crédito público para finalidades del consumo', None, 'FP, Hacienda'),
 }),
 dict(code='V41', dim='economia', bal=True, text='El Estado debe dejar de subvencionar empresas y cooperativas que no son viables.', pos={
  'PNF21': ('+', 'sopprimendo ogni sussidio o favore, da parte dello Stato o altri Enti pubblici, a Consorzi, Cooperative, Industrie, clientele e simili, incapaci di vita propria', 'suprimiendo todo subsidio o favor del Estado o de otros entes públicos a consorcios, cooperativas, industrias, clientelas y similares incapaces de vivir por sí mismos', 'Politica finanziaria, obiettivi 3'),
 }),
 dict(code='V42', dim='economia', bal=False, text='El Estado debe impulsar grandes planes de obras públicas.', pos={
  'FP36': ('+', 'Se llevarán a cabo grandes planes de construcciones de viviendas urbanas y rurales, servicios cooperativos y comunales, puertos, vías de comunicación, obras de riego', None, 'FP, El régimen de obras públicas, 1.º'),
  'PNF21': ('+', 'La formazione di un piano organico di lavori pubblici', 'La formación de un plan orgánico de obras públicas', 'Politica finanziaria, obiettivi 7'),
  'CEDA33': ('+', 'Procede iniciar una política de obras hidráulicas, con arreglo a planes económicos de conjunto', None, 'X, 4.ª (BOE, cita del programa)'),
  'FE34': ('+', 'Acelerando las obras hidráulicas.', None, 'Punto 18'),
 }),
 dict(code='V43', dim='economia', bal=True, text='La industria de armamento puede estar en manos privadas.', pos={
  'FASCI19': ('−', 'La nazionalizzazione di tutte le Fabbriche di Armi e di esplosivi.', 'La nacionalización de todas las fábricas de armas y explosivos.', 'Problema militar, b'),
 }),
 dict(code='V44', dim='economia', bal=True, text='Debe respetarse la propiedad de la vivienda, también la de los ricos.', pos={
  'PCR19': ('−', 'it transferred masses of workers from the slum districts in the suburbs to bourgeois houses', 'trasladó a masas de obreros de los barrios miserables de las afueras a casas burguesas', 'Vivienda, 23'),
 }),
 # ── Trabajo ───────────────────────────────────────────────────────
 dict(code='V45', dim='trabajo', bal=True, text='El conflicto entre trabajadores y empresarios debe sustituirse por la colaboración: la lucha de clases debe desaparecer.', pos={
  'FE34': ('+', 'Nuestro régimen hará radicalmente imposible la lucha de clases', None, 'Punto 11'),
  'CEDA33': ('+', 'Se rechaza el principio marxista de la lucha de clases.', None, 'IX, 1.ª (Junta)'),
  'PNF21': ('(+)', 'perché siano disciplinate le incomposte lotte degli interessi di categorie e di classi', 'para que se disciplinen las desordenadas luchas de intereses de categorías y de clases', 'Capisaldi di politica sociale, a'),
  'BN34': ('(+)', '¿Quiere o no España la supresión de la lucha de clases?', None, 'Junta, p. 82. Pregunta retórica'),
  'PCR19': ('−', 'The Soviet state, by its very essence, has the object of crushing the resistance of the exploiters', 'El Estado soviético tiene por esencia el objetivo de aplastar la resistencia de los explotadores', 'Política general, 2'),
 }),
 dict(code='V46', dim='trabajo', bal=False, text='Trabajadores y empresarios deben integrarse en sindicatos o corporaciones únicos y obligatorios, organizados por el Estado.', pos={
  'FE34': ('+', 'Organizaremos corporativamente a la sociedad española, mediante un sistema de Sindicatos verticales por ramas de la producción', None, 'Punto 9'),
  'BN34': ('(+)', 'Hay que encuadrar la vida económica en corporaciones profesionales.', None, 'Junta, p. 81'),
 }),
 dict(code='V47', dim='trabajo', bal=False, text='Los sindicatos obreros deben poder gestionar industrias y servicios públicos.', pos={
  'FASCI19': ('+', "L'affidamento alle stesse organizzazioni proletarie (che ne siano degne moralmente e tecnicamente) della gestione di industrie o servizi pubblici.", 'Confiar a las propias organizaciones proletarias (que sean moral y técnicamente dignas) la gestión de industrias o servicios públicos.', 'Problema social, d'),
  'PNF21': ('+', "L'affidamento della gestione di industrie o di servizi pubblici ad organizzazioni sindacali che ne siano moralmente degne e tecnicamente preparate.", 'Confiar la gestión de industrias o servicios públicos a organizaciones sindicales moralmente dignas y técnicamente preparadas.', 'Le corporazioni, 4'),
  'PCR19': ('+', 'they must eventually concentrate in their hands the entire management of the whole of national economy as a single economic unit', 'deben concentrar finalmente en sus manos toda la gestión de la economía nacional como una sola unidad económica', 'Economía (sindicatos)'),
 }),
 dict(code='V48', dim='trabajo', bal=False, text='Todo el que pueda tiene el deber de trabajar.', pos={
  'NSDAP20': ('+', 'Erste Pflicht jedes Staatsbürgers muß sein, geistig oder körperlich zu schaffen.', 'El primer deber de todo ciudadano debe ser trabajar, con la mente o con el cuerpo.', 'Punto 10'),
  'FE34': ('+', 'Todos los españoles no impedidos tienen el deber del trabajo.', None, 'Punto 16'),
 }),
 dict(code='V49', dim='trabajo', bal=False, text='Hay que mejorar las pensiones y adelantar la edad de jubilación.', pos={
  'FASCI19': ('+', 'abbassando il limite di età, proposto attualmente a 65 anni, a 55 anni', 'rebajando el límite de edad, hoy propuesto en 65 años, a 55 años', 'Problema social, f'),
  'NSDAP20': ('(+)', 'Wir fordern einen großzügigen Ausbau der Altersversorgung.', 'Exigimos una ampliación generosa de las pensiones de vejez.', 'Punto 15'),
 }),
 dict(code='V50', dim='trabajo', bal=False, text='Hay que prohibir el trabajo infantil y proteger a las madres trabajadoras.', pos={
  'NSDAP20': ('+', 'durch den Schutz der Mutter und des Kindes, durch Verbot der Jugendarbeit', 'mediante la protección de la madre y el niño y la prohibición del trabajo infantil', 'Punto 21'),
  'PCR19': ('+', 'prohibition of child labor and the labor of juveniles under 16', 'prohibición del trabajo infantil y del de los menores de 16 años', 'Protección del trabajo, 24'),
 }),
]

PROGRAMS = ['FASCI19', 'PNF21', 'NSDAP20', 'TESIS17', 'PCR19', 'FP36', 'FE34', 'CEDA33', 'DER33', 'BN34']
NOTATION = {'+', '−', '(+)', '(−)', '(−)c', '~'}


def norm(s: str) -> str:
    s = unicodedata.normalize('NFC', s).replace('’', "'").replace('’', "'")
    return re.sub(r'\s+', ' ', s).strip().lower()


def verify(src_dir: str) -> int:
    bad = 0
    texts = {p: norm(open(os.path.join(src_dir, f'{p.lower()}.txt'), encoding='utf8').read()) for p in PROGRAMS}
    codes = set()
    for q in Q:
        assert q['code'] not in codes, f"código repetido {q['code']}"
        codes.add(q['code'])
        for p, (mark, quote, tr, where) in q['pos'].items():
            assert p in PROGRAMS and mark in NOTATION, (q['code'], p, mark)
            # El OCR de El Debate (DER33) es ilegible: esas citas se transcribieron leyendo la imagen de la página
            if 'transcrito de la imagen' in where:
                continue
            for part in [x for x in quote.split('[…]') if x.strip()]:
                if norm(part) not in texts[p]:
                    bad += 1
                    print(f"NO ENCONTRADA  {q['code']}/{p}: «{part[:90]}»")
    return bad


def stats():
    evaluable = lambda q: [p for p, v in q['pos'].items() if v[0] != '~']
    lv = {2: [], 3: []}
    for q in Q:
        n = len(evaluable(q))
        if n == 0:
            print('SIN POSICIONES EVALUABLES', q['code'])
            continue
        lv[2 if n >= 2 else 3].append(q)
    for k, qs in lv.items():
        b = sum(1 for q in qs if q['bal'])
        print(f"nivel {k}: {len(qs)} preguntas · ⇄ {b} ({round(100 * b / max(1, len(qs)))} %)")
    print('total nuevas:', len(Q), '· total con el v1:', len(Q) + 15)


def write():
    # filas nuevas en citas/<programa>.md (se reemplazan si ya estaban)
    here = os.path.dirname(os.path.abspath(__file__))
    for p in PROGRAMS:
        path = os.path.join(here, 'citas', f'{p.lower()}.md')
        md = open(path, encoding='utf8').read()
        md = '\n'.join(l for l in md.split('\n') if not re.match(r'^\| V\d\d \|', l))
        rows = []
        for q in Q:
            if p in q['pos']:
                mark, quote, tr, where = q['pos'][p]
                rows.append(f"| {q['code']} | {mark} | «{quote}» | {tr if tr else '(Original en castellano)'} | {where} |")
        if rows:
            lines = md.rstrip('\n').split('\n')
            last = max(i for i, l in enumerate(lines) if re.match(r'^\| [A-Z]\d* \|', l))
            md = '\n'.join(lines[:last + 1] + rows + lines[last + 1:]) + '\n'
        open(path, 'w', encoding='utf8').write(md)
    json.dump([{k: q[k] for k in ('code', 'dim', 'bal', 'text')} for q in Q],
              open(os.path.join(here, 'preguntas-v2.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('escrito')


if __name__ == '__main__':
    if '--verificar' in sys.argv:
        n = verify(sys.argv[sys.argv.index('--verificar') + 1])
        stats()
        print('citas no encontradas:', n)
        sys.exit(1 if n else 0)
    if '--escribir' in sys.argv:
        write()
