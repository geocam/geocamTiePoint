import datetime
from django.db import models
from django.conf import settings
import json

class JSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S')
        elif isinstance(obj, datetime.date):
            return obj.strftime('%Y-%m-%d')
        elif isinstance(obj, datetime.time):
            return obj.strftime('%H:%M:%S')
        return json.JSONEncoder.default(self, obj)
        
def dumps(data):
    return JSONEncoder().encode(data)
    
def loads(str):
    return json.loads(str, encoding=settings.DEFAULT_CHARSET)
    
class JSONField(models.TextField):
    __metaclass__ = models.SubfieldBase

    def db_type(self):
        return 'text'

    def get_db_prep_value(self, value):
        return dumps(value)

    def to_python(self, value):
        if value:
            return loads(value)
        else:
            return None
