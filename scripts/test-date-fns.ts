import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
console.log(formatDistanceToNow(new Date(), { locale: fr }));
